import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusUnidadeProcesso } from '@prisma/client';
import { ArmazenagemBillingService } from '../armazenagem-faturamento/armazenagem-billing.service';
import { CadastrosTabelasServicosService } from '../cadastros/cadastros-tabelas-servicos.service';
import {
  parseServicoEfeito,
  validarCamposEfeito,
  parseEfeitoConfig,
  type LancarServicoEfeitoInput,
  type ServicoEfeitoPayload,
} from '../cadastros/servico-efeito';
import { PrismaService } from '../prisma/prisma.service';
import { ServicoEfeitoAplicarService } from './servico-efeito-aplicar.service';

@Injectable()
export class UnidadeProcessoServicosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: ArmazenagemBillingService,
    private readonly tabelasServicos: CadastrosTabelasServicosService,
    private readonly efeitos: ServicoEfeitoAplicarService,
  ) {}

  async listar(unidadeProcessoId: string) {
    await this.getAbertoOuEncerrado(unidadeProcessoId);
    const rows = await this.prisma.unidadeProcessoServico.findMany({
      where: { unidadeProcessoId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        codigo: r.codigo,
        nome: r.nome,
        quantidade: Number(r.quantidade),
        valorUnitario: Number(r.valorUnitario),
        valorTotal: Number(r.valorTotal),
        createdAt: r.createdAt.toISOString(),
        payload: r.payload,
      })),
    };
  }

  async catalogo() {
    return this.tabelasServicos.listCatalogoAtivo();
  }

  async lancar(
    unidadeProcessoId: string,
    input: { servicoItemId: string; quantidade: number } & LancarServicoEfeitoInput,
    userId?: string,
  ) {
    const processo = await this.getAberto(unidadeProcessoId);
    const qtd = Number(input.quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero.');
    }
    const item = await this.prisma.cadastroServicoItem.findFirst({
      where: { id: input.servicoItemId, deletedAt: null, ativo: true },
    });
    if (!item) throw new NotFoundException('Serviço do catálogo não encontrado ou inativo.');

    const efeito = parseServicoEfeito(item.efeito);
    const config = parseEfeitoConfig(item.efeitoConfig);
    const valid = validarCamposEfeito(efeito, input, config);
    if (!valid.ok) throw new BadRequestException(valid.erro);

    const aplicado = await this.efeitos.aplicar({
      processoId: processo.id,
      item,
      input,
    });

    const valorUnitario = Number(item.valor);
    const valorTotal = Math.round(qtd * valorUnitario * 100) / 100;
    const row = await this.prisma.unidadeProcessoServico.create({
      data: {
        unidadeProcessoId: processo.id,
        cadastroServicoItemId: item.id,
        codigo: item.codigo,
        nome: item.nome,
        quantidade: new Prisma.Decimal(qtd.toFixed(2)),
        valorUnitario: new Prisma.Decimal(valorUnitario.toFixed(2)),
        valorTotal: new Prisma.Decimal(valorTotal.toFixed(2)),
        lancadoPorUserId: userId ?? null,
        payload: aplicado.payload as Prisma.InputJsonValue,
      },
    });
    if (aplicado.linhasExtras.length) {
      await this.prisma.unidadeProcessoServico.createMany({ data: aplicado.linhasExtras });
    }
    await this.billing.refreshExtrasForProcesso(processo.id);
    return {
      id: row.id,
      codigo: row.codigo,
      nome: row.nome,
      quantidade: qtd,
      valorUnitario,
      valorTotal,
      payload: aplicado.payload,
    };
  }

  async remover(unidadeProcessoId: string, lancamentoId: string) {
    await this.getAberto(unidadeProcessoId);
    const row = await this.prisma.unidadeProcessoServico.findFirst({
      where: { id: lancamentoId, unidadeProcessoId },
    });
    if (!row) throw new NotFoundException('Lançamento não encontrado.');
    const payload = (row.payload ?? {}) as ServicoEfeitoPayload;
    const efeito = parseServicoEfeito(payload.efeito);
    if (efeito !== 'NENHUM' || payload.vinculado) {
      throw new BadRequestException(
        'Este lançamento já alterou lacre ou status. Não estorne por aqui — evite desfazer a operação pela metade.',
      );
    }
    await this.prisma.unidadeProcessoServico.delete({ where: { id: lancamentoId } });
    await this.billing.refreshExtrasForProcesso(unidadeProcessoId);
    return { ok: true };
  }

  private async getAberto(id: string) {
    const row = await this.prisma.unidadeProcesso.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('ID não encontrado.');
    if (row.status !== StatusUnidadeProcesso.ABERTO) {
      throw new BadRequestException('Só é possível lançar serviço em ID aberto.');
    }
    return row;
  }

  private async getAbertoOuEncerrado(id: string) {
    const row = await this.prisma.unidadeProcesso.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('ID não encontrado.');
    return row;
  }
}
