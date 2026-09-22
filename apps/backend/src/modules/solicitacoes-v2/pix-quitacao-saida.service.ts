import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ModalidadeUnidadeProcesso,
  Prisma,
  StatusPreFatura,
  StatusUnidadeProcesso,
  TipoOperacaoSolicitacaoIntent,
} from '@prisma/client';
import { ArmazenagemBillingService } from '../../armazenagem-faturamento/armazenagem-billing.service';
import { clienteExigeQuitacaoPix } from '../../cadastro-financeiro/cadastro-operacao-inicial';
import { isValidIso6346 } from '../../common/utils/iso6346';
import { stripContainerIsoCanonical } from '../../common/utils/data-sanitize';
import { ContaCorrenteService } from '../../conta-corrente/conta-corrente.service';
import { toMoneyNumber } from '../../conta-corrente/conta-corrente.util';
import { PrismaService } from '../../prisma/prisma.service';
import { formatUnidadeProcessoId, isDirecaoSaida } from '../../unidade-processo/unidade-direcao.util';
import {
  conflictSaldoInsuficiente,
  type CotacaoPixIdItem,
  type CotacaoPixSaida,
  montarDescricaoQuitacao,
} from './pix-quitacao-saida.util';

@Injectable()
export class PixQuitacaoSaidaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: ArmazenagemBillingService,
    private readonly contaCorrente: ContaCorrenteService,
  ) {}

  async cotar(params: {
    clienteId: string;
    intent: TipoOperacaoSolicitacaoIntent | string;
    unidades: string[];
    refreshExtras?: boolean;
    db?: Prisma.TransactionClient | PrismaService;
  }): Promise<CotacaoPixSaida> {
    const db = params.db ?? this.prisma;
    const vazio: CotacaoPixSaida = {
      exigido: false,
      suficiente: true,
      saldo: 0,
      valor: 0,
      saldoApos: 0,
      ids: [],
    };
    if (!isDirecaoSaida(params.intent)) return vazio;

    const cliente = await db.cliente.findFirst({
      where: { id: params.clienteId, deletedAt: null },
      select: { id: true, tenantId: true, statusCadastro: true, condicaoPagamento: true },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado.');
    if (!clienteExigeQuitacaoPix(cliente.statusCadastro, cliente.condicaoPagamento)) {
      return vazio;
    }

    const isos = uniqueIsos(params.unidades);
    const ids: CotacaoPixIdItem[] = [];
    for (const iso of isos) {
      const processo = await db.unidadeProcesso.findFirst({
        where: {
          clienteId: cliente.id,
          unidadeIso: iso,
          modalidade: ModalidadeUnidadeProcesso.PATIO,
          status: StatusUnidadeProcesso.ABERTO,
        },
        select: { id: true, numero: true, unidadeIso: true },
        orderBy: { numero: 'desc' },
      });
      if (!processo) continue;
      if (params.refreshExtras !== false) {
        await this.billing.refreshExtrasForProcesso(processo.id);
      }
      const pf = await db.preFatura.findFirst({
        where: {
          unidadeProcessoId: processo.id,
          clienteId: cliente.id,
          status: StatusPreFatura.ABERTA,
        },
        select: { valorAcumulado: true },
        orderBy: { segmento: 'desc' },
      });
      ids.push({
        unidadeIso: processo.unidadeIso,
        unidadeProcessoId: processo.id,
        unidadeProcessoNumero: processo.numero,
        unidadeProcessoLabel: formatUnidadeProcessoId(processo.numero),
        valor: toMoneyNumber(pf?.valorAcumulado),
      });
    }

    const valor = toMoneyNumber(ids.reduce((acc, i) => acc + i.valor, 0));
    const saldo = await this.contaCorrente.saldoCliente(cliente.id, db);
    const saldoApos = toMoneyNumber(saldo - valor);
    const exigido = valor > 0.005;
    return {
      exigido,
      suficiente: !exigido || saldoApos >= -0.005,
      saldo,
      valor,
      saldoApos,
      ids,
    };
  }

  async debitarNaTransacao(
    tx: Prisma.TransactionClient,
    params: {
      clienteId: string;
      tenantId: string;
      intent: TipoOperacaoSolicitacaoIntent | string;
      unidades: string[];
      protocolo: number | string;
      solicitacaoId: string;
      actorId: string;
      actorNome: string;
    },
  ): Promise<CotacaoPixSaida> {
    const quote = await this.cotar({
      clienteId: params.clienteId,
      intent: params.intent,
      unidades: params.unidades,
      refreshExtras: false,
      db: tx,
    });
    if (!quote.exigido) return quote;
    if (!quote.suficiente) throw conflictSaldoInsuficiente(quote);

    await this.contaCorrente.debitarNaTransacao(tx, {
      tenantId: params.tenantId,
      clienteId: params.clienteId,
      valor: quote.valor,
      descricao: montarDescricaoQuitacao({ protocolo: params.protocolo, ids: quote.ids }),
      referencia: `SOL:${params.solicitacaoId}`.slice(0, 120),
      createdByUserId: params.actorId,
      createdByNome: params.actorNome,
    });
    return quote;
  }
}

function uniqueIsos(unidades: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of unidades) {
    const iso = stripContainerIsoCanonical(raw);
    if (!iso || !isValidIso6346(iso) || seen.has(iso)) continue;
    seen.add(iso);
    out.push(iso);
  }
  return out;
}
