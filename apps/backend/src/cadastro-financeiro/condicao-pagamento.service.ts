import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TipoOpcaoPagamento } from '@prisma/client';
import { resolveStoreTenantId } from '../common/stores/store-tenant.util';
import { DEFAULT_TENANT_ID } from '../tenant/tenant.constants';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import {
  assertVencimentosValidos,
  montarParcelasFinanceiras,
  type ParcelaFinanceira,
} from './prazo-parcelas.util';
import { prazoEfetivoCadastro } from './cadastro-operacao-inicial';

export type CondicaoPagamentoOption = {
  label: string;
  value: string;
  dias?: number | null;
  vencimentos?: number[];
  formaVinculada?: string | null;
};

export type OpcaoPagamentoRow = {
  id: string;
  tipo: TipoOpcaoPagamento;
  label: string;
  value: string;
  ativo: boolean;
  ordem: number;
  dias: number | null;
  vencimentos: number[];
  formaVinculada: string | null;
};

type PrazoSeed = CondicaoPagamentoOption & { vencimentos: number[]; formaVinculada: string };

const FALLBACK_FORMA: CondicaoPagamentoOption[] = [
  { label: 'Faturamento', value: 'FATURAMENTO' },
  { label: 'À Vista PIX', value: 'AVISTA_PIX' },
];

const FALLBACK_PRAZO: PrazoSeed[] = [
  { label: 'À vista', value: 'A_VISTA', vencimentos: [0], formaVinculada: 'AVISTA_PIX' },
  { label: '30 dias', value: '30_DIAS', vencimentos: [30], formaVinculada: 'FATURAMENTO' },
  { label: '30/60 dias', value: '30_60', vencimentos: [30, 60], formaVinculada: 'FATURAMENTO' },
  { label: '30/60/90 dias', value: '30_60_90', vencimentos: [30, 60, 90], formaVinculada: 'FATURAMENTO' },
  { label: 'Personalizado', value: 'PERSONALIZADO', vencimentos: [30], formaVinculada: 'FATURAMENTO' },
];

@Injectable()
export class CondicaoPagamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async listarAtivas(tipo: TipoOpcaoPagamento = TipoOpcaoPagamento.FORMA): Promise<CondicaoPagamentoOption[]> {
    const config = await this.findConfig();
    if (!config) return this.fallback(tipo);
    await this.backfillPrazos(config.id, tipo);
    const rows = await this.prisma.condicaoPagamentoPersonalizada.findMany({
      where: { tenantId: config.id, tipo, ativo: true },
      orderBy: [{ ordem: 'asc' }, { label: 'asc' }],
    });
    if (!rows.length) return this.fallback(tipo);
    return rows.map((c) => ({
      label: c.label,
      value: c.value,
      dias: c.dias ?? c.vencimentos[0] ?? null,
      vencimentos: c.vencimentos ?? [],
      formaVinculada: c.formaVinculada,
    }));
  }

  /** Dias de vencimento do prazo ativo (0 = à vista). Primeira parcela. */
  async obterDiasPrazo(value: string): Promise<number | null> {
    const cal = await this.obterCalendarioPrazo(value);
    return cal.vencimentos[0] ?? null;
  }

  /** Calendário de boletos: N vencimentos = N parcelas. */
  async obterCalendarioPrazo(value: string): Promise<{
    vencimentos: number[];
    formaVinculada: string | null;
  }> {
    const opcoes = await this.listarAtivas(TipoOpcaoPagamento.PRAZO);
    const found = opcoes.find((o) => o.value === value);
    if (!found) return { vencimentos: [], formaVinculada: null };
    const vencimentos =
      found.vencimentos?.length
        ? found.vencimentos
        : found.dias != null
          ? [found.dias]
          : [];
    return { vencimentos, formaVinculada: found.formaVinculada ?? null };
  }

  async obterParcelasDoCliente(
    clienteId: string,
    emissao: Date,
    valorTotal: number,
  ): Promise<ParcelaFinanceira[]> {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      select: { prazoPagamento: true, tenantId: true, statusCadastro: true },
    });
    const prazo = prazoEfetivoCadastro(cliente?.statusCadastro, cliente?.prazoPagamento);
    if (!cliente || !prazo) return [];
    const config = await this.prisma.tenantConfig.findFirst({
      where: {
        OR: [
          { tenantId: cliente.tenantId },
          { tenantKey: cliente.tenantId === DEFAULT_TENANT_ID ? 'default' : cliente.tenantId },
        ],
      },
      select: { id: true },
    });
    const row = config
      ? await this.prisma.condicaoPagamentoPersonalizada.findFirst({
          where: {
            tenantId: config.id,
            tipo: TipoOpcaoPagamento.PRAZO,
            value: prazo,
            ativo: true,
          },
          select: { vencimentos: true, dias: true },
        })
      : null;
    const seed = FALLBACK_PRAZO.find((p) => p.value === prazo);
    const vencimentos =
      row?.vencimentos?.length
        ? row.vencimentos
        : row?.dias != null
          ? [row.dias]
          : (seed?.vencimentos ?? []);
    if (!vencimentos.length) return [];
    return montarParcelasFinanceiras({ emissao, valorTotal, vencimentos });
  }

  /** Forma de pagamento definida pelo prazo (PIX à vista, faturamento nos prazos). */
  async obterFormaVinculada(prazoValue: string): Promise<string | null> {
    const opcoes = await this.listarAtivas(TipoOpcaoPagamento.PRAZO);
    return opcoes.find((o) => o.value === prazoValue)?.formaVinculada ?? null;
  }

  async assertValorPermitido(
    value: string,
    tipo: TipoOpcaoPagamento = TipoOpcaoPagamento.FORMA,
  ): Promise<void> {
    const opcoes = await this.listarAtivas(tipo);
    if (!opcoes.some((o) => o.value === value)) {
      const nome = tipo === TipoOpcaoPagamento.PRAZO ? 'Prazo' : 'Forma de pagamento';
      throw new NotFoundException(`${nome} "${value}" não configurado para o tenant`);
    }
  }

  async listarCatalogo(tipo: TipoOpcaoPagamento): Promise<OpcaoPagamentoRow[]> {
    const config = await this.requireConfig();
    await this.ensureDefaults(config.id, tipo);
    await this.backfillPrazos(config.id, tipo);
    const rows = await this.prisma.condicaoPagamentoPersonalizada.findMany({
      where: { tenantId: config.id, tipo },
      orderBy: [{ ordem: 'asc' }, { label: 'asc' }],
    });
    return rows.map(this.toRow);
  }

  async criar(input: {
    tipo: TipoOpcaoPagamento;
    label: string;
    value?: string;
    ativo?: boolean;
    dias?: number;
    vencimentos?: number[];
    formaVinculada?: string;
  }): Promise<OpcaoPagamentoRow> {
    const config = await this.requireConfig();
    const label = input.label.trim();
    if (label.length < 2) throw new BadRequestException('Informe um nome com pelo menos 2 caracteres.');
    const value = slugifyValue(input.value?.trim() || label);
    if (!value) throw new BadRequestException('Código interno inválido.');
    await this.assertValueUnico(config.id, input.tipo, value);
    const extra = await this.camposPrazo(config.id, input);
    const maxOrdem = await this.prisma.condicaoPagamentoPersonalizada.aggregate({
      where: { tenantId: config.id, tipo: input.tipo },
      _max: { ordem: true },
    });
    const row = await this.prisma.condicaoPagamentoPersonalizada.create({
      data: {
        tenantId: config.id,
        tipo: input.tipo,
        label,
        value,
        ativo: input.ativo ?? true,
        ordem: (maxOrdem._max.ordem ?? -1) + 1,
        ...extra,
      },
    });
    return this.toRow(row);
  }

  async atualizar(
    id: string,
    input: {
      label?: string;
      ativo?: boolean;
      dias?: number;
      vencimentos?: number[];
      formaVinculada?: string;
    },
  ): Promise<OpcaoPagamentoRow> {
    const config = await this.requireConfig();
    const atual = await this.prisma.condicaoPagamentoPersonalizada.findFirst({
      where: { id, tenantId: config.id },
    });
    if (!atual) throw new NotFoundException('Opção não encontrada.');
    const label = input.label?.trim();
    if (label !== undefined && label.length < 2) {
      throw new BadRequestException('Informe um nome com pelo menos 2 caracteres.');
    }
    const extra =
      atual.tipo === TipoOpcaoPagamento.PRAZO
        ? await this.camposPrazo(config.id, {
            tipo: TipoOpcaoPagamento.PRAZO,
            dias: input.dias ?? atual.dias ?? undefined,
            vencimentos: input.vencimentos ?? atual.vencimentos,
            formaVinculada: input.formaVinculada ?? atual.formaVinculada ?? undefined,
          })
        : { dias: null, vencimentos: [], formaVinculada: null };
    const row = await this.prisma.condicaoPagamentoPersonalizada.update({
      where: { id },
      data: {
        ...(label ? { label } : {}),
        ...(typeof input.ativo === 'boolean' ? { ativo: input.ativo } : {}),
        ...extra,
      },
    });
    return this.toRow(row);
  }

  async excluir(id: string): Promise<void> {
    const config = await this.requireConfig();
    const atual = await this.prisma.condicaoPagamentoPersonalizada.findFirst({
      where: { id, tenantId: config.id },
    });
    if (!atual) throw new NotFoundException('Opção não encontrada.');
    if (atual.tipo === TipoOpcaoPagamento.FORMA) {
      const vinculados = await this.prisma.condicaoPagamentoPersonalizada.count({
        where: { tenantId: config.id, tipo: TipoOpcaoPagamento.PRAZO, formaVinculada: atual.value },
      });
      if (vinculados > 0) {
        throw new ConflictException(
          `Não é possível excluir: ${vinculados} prazo(s) ainda usam esta forma de pagamento.`,
        );
      }
    }
    const emUso = await this.contarUso(atual);
    if (emUso > 0) {
      throw new ConflictException(
        `Não é possível excluir: ${emUso} cliente(s) ainda usam esta opção. Inative-a ou altere os clientes antes.`,
      );
    }
    await this.prisma.condicaoPagamentoPersonalizada.delete({ where: { id } });
  }

  private fallback(tipo: TipoOpcaoPagamento): CondicaoPagamentoOption[] {
    return tipo === TipoOpcaoPagamento.PRAZO ? FALLBACK_PRAZO : FALLBACK_FORMA;
  }

  private toRow(row: {
    id: string;
    tipo: TipoOpcaoPagamento;
    label: string;
    value: string;
    ativo: boolean;
    ordem: number;
    dias: number | null;
    vencimentos?: number[];
    formaVinculada: string | null;
  }): OpcaoPagamentoRow {
    const vencimentos = row.vencimentos?.length
      ? row.vencimentos
      : row.dias != null
        ? [row.dias]
        : [];
    return {
      id: row.id,
      tipo: row.tipo,
      label: row.label,
      value: row.value,
      ativo: row.ativo,
      ordem: row.ordem,
      dias: vencimentos[0] ?? row.dias,
      vencimentos,
      formaVinculada: row.formaVinculada,
    };
  }

  private async camposPrazo(
    tenantConfigId: string,
    input: {
      tipo: TipoOpcaoPagamento;
      dias?: number;
      vencimentos?: number[];
      formaVinculada?: string;
    },
  ): Promise<{ dias: number | null; vencimentos: number[]; formaVinculada: string | null }> {
    if (input.tipo !== TipoOpcaoPagamento.PRAZO) {
      return { dias: null, vencimentos: [], formaVinculada: null };
    }
    const raw =
      input.vencimentos?.length
        ? input.vencimentos
        : input.dias != null
          ? [Math.floor(Number(input.dias))]
          : [];
    let vencimentos: number[];
    try {
      vencimentos = assertVencimentosValidos(raw);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    const forma = input.formaVinculada?.trim();
    if (!forma) throw new BadRequestException('Vincule uma forma de pagamento a este prazo.');
    const formaOk = await this.prisma.condicaoPagamentoPersonalizada.findFirst({
      where: {
        tenantId: tenantConfigId,
        tipo: TipoOpcaoPagamento.FORMA,
        value: forma,
        ativo: true,
      },
    });
    if (!formaOk && !FALLBACK_FORMA.some((f) => f.value === forma)) {
      throw new BadRequestException('Forma de pagamento vinculada não encontrada ou inativa.');
    }
    return { dias: vencimentos[0] ?? 0, vencimentos, formaVinculada: forma };
  }

  private async findConfig() {
    const tenantKey = resolveStoreTenantId(this.tenantCtx);
    return this.prisma.tenantConfig.findFirst({
      where: {
        OR: [{ tenantId: tenantKey }, { tenantKey: tenantKey === DEFAULT_TENANT_ID ? 'default' : tenantKey }],
      },
      select: { id: true },
    });
  }

  private async requireConfig() {
    const config = await this.findConfig();
    if (!config) throw new NotFoundException('Configuração do terminal não encontrada.');
    return config;
  }

  private async backfillPrazos(tenantConfigId: string, tipo: TipoOpcaoPagamento) {
    if (tipo !== TipoOpcaoPagamento.PRAZO) return;
    const incompletos = await this.prisma.condicaoPagamentoPersonalizada.findMany({
      where: {
        tenantId: tenantConfigId,
        tipo: TipoOpcaoPagamento.PRAZO,
        OR: [{ dias: null }, { formaVinculada: null }, { vencimentos: { isEmpty: true } }],
      },
    });
    for (const row of incompletos) {
      const seed = FALLBACK_PRAZO.find((p) => p.value === row.value);
      const vencimentos =
        row.vencimentos?.length
          ? row.vencimentos
          : (seed?.vencimentos ?? (row.dias != null ? [row.dias] : [30]));
      await this.prisma.condicaoPagamentoPersonalizada.update({
        where: { id: row.id },
        data: {
          dias: vencimentos[0] ?? 30,
          vencimentos,
          formaVinculada: row.formaVinculada ?? seed?.formaVinculada ?? 'FATURAMENTO',
        },
      });
    }
  }

  private async ensureDefaults(tenantConfigId: string, tipo: TipoOpcaoPagamento) {
    const count = await this.prisma.condicaoPagamentoPersonalizada.count({
      where: { tenantId: tenantConfigId, tipo },
    });
    if (count > 0) return;
    if (tipo === TipoOpcaoPagamento.PRAZO) {
      await this.ensureDefaults(tenantConfigId, TipoOpcaoPagamento.FORMA);
    }
    const seed = this.fallback(tipo);
    await this.prisma.condicaoPagamentoPersonalizada.createMany({
      data: seed.map((item, ordem) => ({
        tenantId: tenantConfigId,
        tipo,
        label: item.label,
        value: item.value,
        ativo: true,
        ordem,
        dias: item.vencimentos?.[0] ?? item.dias ?? null,
        vencimentos: item.vencimentos ?? [],
        formaVinculada: item.formaVinculada ?? null,
      })),
    });
  }

  private async assertValueUnico(tenantConfigId: string, tipo: TipoOpcaoPagamento, value: string) {
    const dup = await this.prisma.condicaoPagamentoPersonalizada.findFirst({
      where: { tenantId: tenantConfigId, tipo, value },
    });
    if (dup) throw new ConflictException('Já existe uma opção com este código.');
  }

  private async contarUso(opcao: { tipo: TipoOpcaoPagamento; value: string }): Promise<number> {
    const field = opcao.tipo === TipoOpcaoPagamento.PRAZO ? 'prazoPagamento' : 'condicaoPagamento';
    return this.prisma.cliente.count({
      where: { deletedAt: null, [field]: opcao.value },
    });
  }
}

export function slugifyValue(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}
