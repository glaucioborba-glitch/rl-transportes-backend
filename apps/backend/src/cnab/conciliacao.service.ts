import { Injectable, Logger } from '@nestjs/common';
import { Prisma, StatusPagamentoFatura } from '@prisma/client';
import { BOLETO_STATUS } from '../common/finance/boleto-status.constants';
import { HoldReleaseService } from '../hold-release/hold-release.service';
import { PrismaService } from '../prisma/prisma.service';
import { PRISMA_SERIALIZABLE_TX } from '../prisma/transaction-options';
import type { CnabLinhaRetorno, ConciliacaoCnabResult } from './types/cnab.types';

const SISTEMA = 'SISTEMA';
const BOLETO_PAGO = [BOLETO_STATUS.PAGO, 'PAGO'];
const VALOR_TOLERANCIA = 0.05;

function normalizeNossoNumero(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  return digits || trimmed;
}

function num(d: Prisma.Decimal | null | undefined): number {
  if (d === null || d === undefined) return 0;
  return Number(d.toFixed(2));
}

function formatBrl(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

@Injectable()
export class ConciliacaoService {
  private readonly logger = new Logger(ConciliacaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly holdRelease: HoldReleaseService,
  ) {}

  async processarRetorno(
    arquivoId: string,
    tenantId: string,
    input: { nomeArquivo: string; linhas: CnabLinhaRetorno[] },
  ): Promise<ConciliacaoCnabResult> {
    void arquivoId;

    const result: ConciliacaoCnabResult = {
      faturasBaixadas: 0,
      faturasNaoEncontradas: 0,
      faturasValorDivergente: 0,
      clientesDesbloqueados: 0,
      erros: [],
      resumo: '',
    };

    const clientesLiberados = new Set<string>();
    const linhasLiquidadas = input.linhas.filter(
      (l) => !l.codigoMovimento || l.codigoMovimento === '06',
    );

    for (const linha of linhasLiquidadas) {
      const nossoNumero = normalizeNossoNumero(linha.nossoNumero);
      if (!nossoNumero) {
        result.erros.push({ nossoNumero: linha.nossoNumero, motivo: 'Nosso número inválido' });
        continue;
      }

      const fatura = await this.findFaturaAberta(tenantId, nossoNumero);
      if (!fatura) {
        result.faturasNaoEncontradas += 1;
        result.erros.push({
          nossoNumero,
          motivo: `Nosso Número ${nossoNumero} não encontrado no banco de dados`,
        });
        continue;
      }

      const valorEsperado = num(fatura.valorAtualizado ?? fatura.valorTotal);
      const diff = valorEsperado - linha.valorPago;

      if (linha.valorPago + VALOR_TOLERANCIA < valorEsperado) {
        result.faturasValorDivergente += 1;
        result.erros.push({
          nossoNumero,
          motivo: `Nosso Número ${nossoNumero} pago a menor. Esperado: ${formatBrl(valorEsperado)}. Recebido: ${formatBrl(linha.valorPago)}`,
        });
        continue;
      }

      if (Math.abs(diff) > VALOR_TOLERANCIA) {
        result.faturasValorDivergente += 1;
        result.erros.push({
          nossoNumero,
          motivo: `Nosso Número ${nossoNumero} valor divergente. Esperado: ${formatBrl(valorEsperado)}. Recebido: ${formatBrl(linha.valorPago)}`,
        });
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.fatura.update({
          where: { id: fatura.id },
          data: {
            statusPagamento: StatusPagamentoFatura.PAGO,
            dataPagamento: linha.dataPagamento,
          },
        });

        if (fatura.faturamentoId) {
          await tx.boleto.updateMany({
            where: {
              faturamentoId: fatura.faturamentoId,
              statusPagamento: { notIn: [...BOLETO_PAGO] },
            },
            data: { statusPagamento: BOLETO_STATUS.PAGO },
          });
        }
      }, PRISMA_SERIALIZABLE_TX);

      result.faturasBaixadas += 1;

      if (!clientesLiberados.has(fatura.clienteId)) {
        const { liberados } = await this.holdRelease.liberarBloqueioFinanceiro(
          fatura.clienteId,
          tenantId,
          SISTEMA,
        );
        if (liberados > 0) {
          clientesLiberados.add(fatura.clienteId);
          result.clientesDesbloqueados += 1;
          this.logger.log(
            `Desbloqueio automático via Conciliação Bancária (Arquivo: ${input.nomeArquivo}) — cliente=${fatura.clienteId} holds=${liberados}`,
          );
        }
      }
    }

    result.resumo = `${result.faturasBaixadas} faturas baixadas, ${result.faturasNaoEncontradas} não encontradas`;
    if (result.faturasValorDivergente > 0) {
      result.resumo += `, ${result.faturasValorDivergente} com valor divergente`;
    }
    return result;
  }

  private async findFaturaAberta(tenantId: string, nossoNumero: string) {
    const openWhere: Prisma.FaturaWhereInput = {
      tenantId,
      statusPagamento: {
        notIn: [StatusPagamentoFatura.PAGO, StatusPagamentoFatura.CANCELADO],
      },
    };

    const variants = [nossoNumero, nossoNumero.padStart(11, '0'), nossoNumero.padStart(20, '0')];

    const byNosso = await this.prisma.fatura.findFirst({
      where: {
        ...openWhere,
        OR: variants.map((n) => ({ nossoNumero: n })),
      },
      select: {
        id: true,
        clienteId: true,
        valorTotal: true,
        valorAtualizado: true,
        faturamentoId: true,
      },
    });
    if (byNosso) return byNosso;

    const boleto = await this.prisma.boleto.findFirst({
      where: {
        OR: [
          { numeroBoleto: nossoNumero },
          { referenciaExterna: nossoNumero },
          { numeroBoleto: { contains: nossoNumero } },
        ],
        statusPagamento: { notIn: [...BOLETO_PAGO] },
        faturamento: { tenantId },
      },
      select: { faturamentoId: true },
    });

    if (!boleto) return null;

    return this.prisma.fatura.findFirst({
      where: { ...openWhere, faturamentoId: boleto.faturamentoId },
      select: {
        id: true,
        clienteId: true,
        valorTotal: true,
        valorAtualizado: true,
        faturamentoId: true,
      },
    });
  }
}
