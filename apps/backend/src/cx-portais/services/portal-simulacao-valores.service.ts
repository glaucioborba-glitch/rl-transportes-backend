import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PatioStatus, StatusPreFatura, StatusSolicitacao } from '@prisma/client';
import { BillingRuleEngineService } from '../../billing-engine/billing-rule-engine.service';
import { ArmazenagemBillingService } from '../../armazenagem-faturamento/armazenagem-billing.service';
import { flagsExclusaoAutomatica } from '../../armazenagem-faturamento/fatura-extras.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { CxPortalRequestUser } from '../types/cx-portal.types';
import { assertClienteDoTenant } from '../portal-cliente-tenant.util';
import { PortalClienteDataService } from './portal-cliente-data.service';
import {
  AVISO_PREVISAO_SIMULACAO,
  MAX_UNIDADES_SIMULACAO,
  mesclarPreFaturaComProjecao,
  parseDataSaida,
  roundMoneySimulacao,
  type ItemSimulacaoLike,
} from '../portal-simulacao-valores.util';
import type { SimularValoresPortalDto } from '../dto/portal-simulacao-valores.dto';

const PATIO_ATIVO: PatioStatus[] = [PatioStatus.ESTOCADO, PatioStatus.MOVIMENTANDO, PatioStatus.SEPARADO];

export type PortalSimulacaoItem = {
  descricao: string;
  detalheCobranca?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  origem: 'PRE_FATURA' | 'PROJECAO';
  eventoGatilho?: string;
};

type UnidadeSaldo = {
  id: string;
  unidadeIso: string;
  tipo: string;
  tamanho: string | null;
  statusContainer: 'CHEIO' | 'VAZIO' | null;
  refrigerado: boolean;
  entradaEm: string;
  protocolo: string;
  diasNoPatio: number;
};

@Injectable()
export class PortalSimulacaoValoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patio: PortalClienteDataService,
    private readonly rules: BillingRuleEngineService,
    private readonly billing: ArmazenagemBillingService,
  ) {}

  async catalogo(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = await this.resolveClienteId(cx, clienteIdParam);
    const saldo = await this.patio.saldoPatio(cx, clienteIdParam);
    const lancados = await this.valoresLancadosPorIso(
      clienteId,
      saldo.items.map((i) => i.unidadeIso),
    );
    return {
      unidades: saldo.items.map((u) => {
        const hit = lancados.get(this.isoKey(u.unidadeIso));
        return {
          ...u,
          valorLancado: hit?.valor ?? 0,
          preFaturaId: hit?.id ?? null,
        };
      }),
      servicos: [] as const,
      atualizadoEm: saldo.atualizadoEm,
      aviso: AVISO_PREVISAO_SIMULACAO,
    };
  }

  async simular(cx: CxPortalRequestUser, dto: SimularValoresPortalDto, clienteIdParam?: string) {
    const ids = this.idsSolicitados(dto);
    const clienteId = await this.resolveClienteId(cx, clienteIdParam);
    const saldo = await this.patio.saldoPatio(cx, clienteIdParam);
    parseDataSaida(dto.dataSaida);

    const unidades: PortalSimulacaoUnidadeResultado[] = [];
    for (const rawId of ids) {
      const unidade = saldo.items.find((i) => i.id === rawId || this.isoKey(i.unidadeIso) === this.isoKey(rawId));
      if (!unidade) {
        throw new NotFoundException(`Unidade ${rawId} não encontrada no pátio da sua empresa.`);
      }
      unidades.push(await this.simularUma(clienteId, unidade as UnidadeSaldo, dto.dataSaida));
    }

    const totalGeral = roundMoneySimulacao(unidades.reduce((acc, u) => acc + u.total, 0));
    const valorLancadoGeral = roundMoneySimulacao(unidades.reduce((acc, u) => acc + u.valorLancado, 0));

    return {
      dataSaida: dto.dataSaida,
      estimativa: true,
      avisoGeral: AVISO_PREVISAO_SIMULACAO,
      unidades,
      totalGeral,
      valorLancadoGeral,
    };
  }

  private idsSolicitados(dto: SimularValoresPortalDto): string[] {
    const fromList = (dto.unidadeIds ?? []).map((id) => id.trim()).filter(Boolean);
    const legacy = dto.unidadeId?.trim();
    const merged = [...new Set(legacy ? [legacy, ...fromList] : fromList)];
    if (!merged.length) {
      throw new BadRequestException('Selecione ao menos uma unidade no pátio.');
    }
    if (merged.length > MAX_UNIDADES_SIMULACAO) {
      throw new BadRequestException(`Simule no máximo ${MAX_UNIDADES_SIMULACAO} unidades por vez.`);
    }
    return merged;
  }

  private async simularUma(
    clienteId: string,
    unidade: UnidadeSaldo,
    dataSaida: string,
  ): Promise<PortalSimulacaoUnidadeResultado> {
    if (dataSaida < unidade.entradaEm.slice(0, 10)) {
      throw new BadRequestException(
        `A data de saída não pode ser anterior à entrada de ${unidade.unidadeIso} no pátio.`,
      );
    }

    const asOf = parseDataSaida(dataSaida);
    const entrada = new Date(unidade.entradaEm);
    let pf = await this.prisma.preFatura.findFirst({
      where: {
        clienteId,
        containerIso: { equals: this.isoKey(unidade.unidadeIso), mode: 'insensitive' },
        status: StatusPreFatura.ABERTA,
      },
      include: { itens: { orderBy: { createdAt: 'asc' } } },
      orderBy: { gateInAt: 'desc' },
    });
    if (pf?.unidadeProcessoId) {
      await this.billing.refreshExtrasForProcesso(pf.unidadeProcessoId);
      pf = await this.prisma.preFatura.findFirst({
        where: { id: pf.id },
        include: { itens: { orderBy: { createdAt: 'asc' } } },
      });
    }

    const resolved = await this.resolveCiclo(clienteId, unidade.id, unidade.unidadeIso, entrada);
    const pricing = await this.rules.resolvePricingForCliente(clienteId);
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      select: { tenantId: true },
    });
    const tenantId = cliente?.tenantId ?? 'default';
    const exclusao = await flagsExclusaoAutomatica(this.prisma, pf?.unidadeProcessoId);

    const evaluation = await this.rules.evaluateForContainerCycleWithTenant(tenantId, {
      gateInAt: resolved.gateInAt,
      asOf,
      regras: pricing.regras,
      container: resolved.container,
      fase: 'GATE_OUT',
      clienteId,
      tabelaPrecoId: pricing.tabelaPrecoId,
      gateInId: resolved.gateInId,
      containerIso: unidade.unidadeIso,
      forcarDiasFreeTime: pf?.freeTimeZerado ? 0 : undefined,
      omitirHandling: exclusao.omitirHandling,
      omitirEnergia: exclusao.omitirEnergia,
    });

    const lancados: ItemSimulacaoLike[] = (pf?.itens ?? []).map((i) => ({
      eventoGatilho: i.eventoGatilho,
      descricao: i.descricao,
      quantidade: i.quantidade,
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    }));
    const projetados: ItemSimulacaoLike[] = evaluation.items.map((i) => ({
      eventoGatilho: i.eventoGatilho,
      descricao: i.descricao,
      detalheCobranca: i.detalheCobranca,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitario,
      valorTotal: i.valorTotal,
    }));
    const mesclados = mesclarPreFaturaComProjecao(lancados, projetados);
    const itens: PortalSimulacaoItem[] = mesclados.map((i) => ({
      descricao: i.descricao,
      detalheCobranca: i.detalheCobranca,
      quantidade: i.quantidade,
      valorUnitario: i.valorUnitario,
      valorTotal: i.valorTotal,
      origem: i.origem,
      eventoGatilho: i.eventoGatilho,
    }));
    const total = roundMoneySimulacao(itens.reduce((acc, i) => acc + i.valorTotal, 0));
    const valorLancado = roundMoneySimulacao(Number(pf?.valorAcumulado ?? 0));

    const avisos: string[] = [];
    if (!pf) {
      avisos.push('Não há pré-fatura aberta para esta unidade. A previsão usa só a tabela vigente.');
    }

    return {
      unidade: {
        id: unidade.id,
        unidadeIso: unidade.unidadeIso,
        tipo: unidade.tipo,
        tamanho: unidade.tamanho,
        statusContainer: unidade.statusContainer,
        refrigerado: unidade.refrigerado,
        entradaEm: unidade.entradaEm,
        protocolo: unidade.protocolo,
      },
      dataSaida,
      diasNoPatio: evaluation.diasNoPatio,
      diasFreeTime: evaluation.diasFreeTime,
      diasFaturaveis: evaluation.diasFaturaveis,
      valorLancado,
      preFaturaId: pf?.id ?? null,
      itens,
      total,
      avisos,
      estimativa: true,
    };
  }

  private async valoresLancadosPorIso(clienteId: string, isos: string[]) {
    const keys = new Set(isos.map((iso) => this.isoKey(iso)).filter(Boolean));
    if (!keys.size) return new Map<string, { id: string; valor: number }>();
    const rows = await this.prisma.preFatura.findMany({
      where: { clienteId, status: StatusPreFatura.ABERTA },
      select: { id: true, containerIso: true, valorAcumulado: true, gateInAt: true, unidadeProcessoId: true },
      orderBy: { gateInAt: 'desc' },
    });
    const seen = new Set<string>();
    for (const row of rows) {
      const k = this.isoKey(row.containerIso);
      if (!keys.has(k) || seen.has(k) || !row.unidadeProcessoId) continue;
      seen.add(k);
      if (Number(row.valorAcumulado) === 0) {
        await this.billing.refreshExtrasForProcesso(row.unidadeProcessoId);
      }
    }
    const refreshed = await this.prisma.preFatura.findMany({
      where: { clienteId, status: StatusPreFatura.ABERTA },
      select: { id: true, containerIso: true, valorAcumulado: true, gateInAt: true },
      orderBy: { gateInAt: 'desc' },
    });
    const map = new Map<string, { id: string; valor: number }>();
    for (const row of refreshed) {
      const k = this.isoKey(row.containerIso);
      if (!keys.has(k) || map.has(k)) continue;
      map.set(k, { id: row.id, valor: Number(row.valorAcumulado) });
    }
    return map;
  }

  private isoKey(iso: string): string {
    return iso.replace(/\s/g, '').toUpperCase();
  }

  private async resolveClienteId(cx: CxPortalRequestUser, clienteIdParam?: string): Promise<string> {
    if (cx.portalPapel === 'STAFF') {
      const id = clienteIdParam?.trim();
      if (!id) throw new BadRequestException('Parâmetro clienteId obrigatório para visão ADMIN/GERENTE');
      return assertClienteDoTenant(this.prisma, cx.tenantId, id);
    }
    const id = cx.clienteId?.trim();
    if (!id) throw new BadRequestException('Usuário portal sem vínculo de cliente');
    return id;
  }

  private async resolveCiclo(
    clienteId: string,
    unidadeId: string,
    unidadeIso: string,
    entradaFallback: Date,
  ): Promise<{
    gateInAt: Date;
    gateInId?: string;
    container: {
      tamanho?: string | null;
      tipo?: string | null;
      refrigerado?: boolean;
      setPoint?: number | null;
      statusContainer?: 'CHEIO' | 'VAZIO' | 'AMBOS' | null;
    };
  }> {
    const byId = await this.prisma.patioUnidade.findFirst({
      where: {
        id: unidadeId,
        solicitacao: { clienteId, deletedAt: null },
        OR: [{ status: { in: PATIO_ATIVO } }, { posicaoAtualId: { not: null } }],
      },
      include: {
        gateIn: { select: { id: true, dataHora: true, checkOut: true } },
      },
    });
    if (byId && !byId.gateIn?.checkOut) {
      const container = await this.rules.loadContainerContext(byId.gateInId, byId.unidadeIso, {
        unidadeProcessoId: byId.unidadeProcessoId,
      });
      return {
        gateInAt: byId.gateIn?.dataHora ?? byId.createdAt,
        gateInId: byId.gateInId ?? undefined,
        container,
      };
    }

    const byIso = await this.prisma.patioUnidade.findFirst({
      where: {
        unidadeIso: { equals: unidadeIso, mode: 'insensitive' },
        solicitacao: { clienteId, deletedAt: null },
        OR: [
          { unidadeProcesso: { status: 'ABERTO' } },
          { gateIn: { checkOut: null } },
          { status: { in: PATIO_ATIVO } },
          { posicaoAtualId: { not: null } },
        ],
      },
      include: { gateIn: { select: { dataHora: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (byIso) {
      const container = await this.rules.loadContainerContext(byIso.gateInId, byIso.unidadeIso, {
        unidadeProcessoId: byIso.unidadeProcessoId,
      });
      return {
        gateInAt: byIso.gateIn?.dataHora ?? byIso.createdAt,
        gateInId: byIso.gateInId ?? undefined,
        container,
      };
    }

    const sol = await this.prisma.solicitacao.findFirst({
      where: {
        clienteId,
        deletedAt: null,
        saida: null,
        status: { in: [StatusSolicitacao.EM_PATIO, StatusSolicitacao.AGUARDANDO_GATE_OUT] },
        containersSolicitacao: { some: { unidade: { equals: unidadeIso, mode: 'insensitive' } } },
      },
      include: {
        patio: { select: { createdAt: true } },
        gate: { select: { createdAt: true } },
        containersSolicitacao: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    const c = sol?.containersSolicitacao.find(
      (row) => row.unidade.replace(/\s/g, '').toUpperCase() === unidadeIso.replace(/\s/g, '').toUpperCase(),
    );
    return {
      gateInAt: sol?.patio?.createdAt ?? sol?.gate?.createdAt ?? entradaFallback,
      container: {
        tamanho: c?.tamanho ?? null,
        tipo: c?.tipo ?? null,
        refrigerado: c?.refrigerado ?? false,
        setPoint: c?.setPoint ?? null,
        statusContainer: c?.status === 'VAZIO' ? 'VAZIO' : c?.status === 'CHEIO' ? 'CHEIO' : null,
      },
    };
  }
}

export type PortalSimulacaoUnidadeResultado = {
  unidade: {
    id: string;
    unidadeIso: string;
    tipo: string;
    tamanho: string | null;
    statusContainer: 'CHEIO' | 'VAZIO' | null;
    refrigerado: boolean;
    entradaEm: string;
    protocolo: string;
  };
  dataSaida: string;
  diasNoPatio: number;
  diasFreeTime: number;
  diasFaturaveis: number;
  valorLancado: number;
  preFaturaId: string | null;
  itens: PortalSimulacaoItem[];
  total: number;
  avisos: string[];
  estimativa: boolean;
};
