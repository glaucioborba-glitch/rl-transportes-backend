import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PatioStatus, StatusSolicitacao } from '@prisma/client';
import { CadastrosTabelasServicosService } from '../../cadastros/cadastros-tabelas-servicos.service';
import { BillingRuleEngineService } from '../../billing-engine/billing-rule-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { CxPortalRequestUser } from '../types/cx-portal.types';
import { assertClienteDoTenant } from '../portal-cliente-tenant.util';
import { PortalClienteDataService } from './portal-cliente-data.service';
import {
  isServicoAdicionalCodigo,
  labelUnidadeCobranca,
  normalizeOperacaoCodigo,
  parseDataSaida,
} from '../portal-simulacao-valores.util';

const PATIO_ATIVO: PatioStatus[] = [PatioStatus.ESTOCADO, PatioStatus.MOVIMENTANDO, PatioStatus.SEPARADO];

export type PortalSimulacaoServico = {
  codigo: string;
  nome: string;
  descricao: string | null;
  unidadeCobranca: string;
  unidadeCobrancaLabel: string;
  valorEstimado: number | null;
};

export type PortalSimulacaoItem = {
  descricao: string;
  detalheCobranca?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  origem: 'ARMAZENAGEM' | 'SERVICO_ADICIONAL';
};

@Injectable()
export class PortalSimulacaoValoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patio: PortalClienteDataService,
    private readonly rules: BillingRuleEngineService,
    private readonly tabelasServicos: CadastrosTabelasServicosService,
  ) {}

  async catalogo(cx: CxPortalRequestUser, clienteIdParam?: string, _unidadeId?: string) {
    const saldo = await this.patio.saldoPatio(cx, clienteIdParam);
    const clienteId = await this.resolveClienteId(cx, clienteIdParam);
    const servicos = await this.listarServicos(clienteId);
    return {
      unidades: saldo.items,
      servicos,
      atualizadoEm: saldo.atualizadoEm,
    };
  }

  async simular(
    cx: CxPortalRequestUser,
    dto: { unidadeId: string; dataSaida: string; servicos?: string[] },
    clienteIdParam?: string,
  ) {
    const clienteId = await this.resolveClienteId(cx, clienteIdParam);
    const saldo = await this.patio.saldoPatio(cx, clienteIdParam);
    const unidade = saldo.items.find((i) => i.id === dto.unidadeId || i.unidadeIso === dto.unidadeId);
    if (!unidade) {
      throw new NotFoundException('Unidade não encontrada no pátio da sua empresa.');
    }

    const asOf = parseDataSaida(dto.dataSaida);
    const entrada = new Date(unidade.entradaEm);
    if (dto.dataSaida < unidade.entradaEm.slice(0, 10)) {
      throw new BadRequestException('A data de saída não pode ser anterior à entrada da unidade no pátio.');
    }

    const resolved = await this.resolveCiclo(clienteId, unidade.id, unidade.unidadeIso, entrada);
    const pricing = await this.rules.resolvePricingForCliente(clienteId);
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      select: { tenantId: true },
    });
    const tenantId = cliente?.tenantId ?? 'default';

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
    });

    const itens: PortalSimulacaoItem[] = evaluation.items.map((item) => ({
      descricao: item.descricao,
      detalheCobranca: item.detalheCobranca,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      valorTotal: item.valorTotal,
      origem: 'ARMAZENAGEM' as const,
    }));

    const avisos: string[] = [];
    const extras = await this.precificarExtras(dto.servicos ?? [], avisos, clienteId);
    itens.push(...extras);

    const total = Math.round(itens.reduce((acc, i) => acc + i.valorTotal, 0) * 100) / 100;

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
      dataSaida: dto.dataSaida,
      diasNoPatio: evaluation.diasNoPatio,
      diasFreeTime: evaluation.diasFreeTime,
      diasFaturaveis: evaluation.diasFaturaveis,
      itens,
      total,
      avisos,
      estimativa: true,
    };
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

  private async listarServicos(clienteId: string): Promise<PortalSimulacaoServico[]> {
    const catalogo = await this.tabelasServicos.listCatalogoAtivo('default', { clienteId });
    return catalogo.items
      .filter((i) => isServicoAdicionalCodigo(i.codigo))
      .map((i) => ({
        codigo: i.codigo,
        nome: i.nome,
        descricao: null,
        unidadeCobranca: i.unidade,
        unidadeCobrancaLabel: labelUnidadeCobranca(i.unidade),
        valorEstimado: i.valor,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  private async precificarExtras(
    servicos: string[],
    avisos: string[],
    clienteId: string,
  ): Promise<PortalSimulacaoItem[]> {
    const wanted = [...new Set(servicos.map(normalizeOperacaoCodigo).filter(isServicoAdicionalCodigo))];
    if (!wanted.length) return [];

    const catalogo = await this.tabelasServicos.listCatalogoAtivo('default', { clienteId });
    if (!catalogo.items.length) {
      avisos.push('Não há tabela de serviços vigente para os adicionais.');
      return [];
    }
    const byCodigo = new Map(catalogo.items.map((i) => [normalizeOperacaoCodigo(i.codigo), i]));

    const itens: PortalSimulacaoItem[] = [];
    for (const codigo of wanted) {
      const hit = byCodigo.get(codigo);
      if (!hit) {
        avisos.push(`Sem preço vigente para ${codigo} na tabela de serviços.`);
        continue;
      }
      const porHora = hit.unidade.toUpperCase() === 'POR_HORA';
      if (porHora) {
        avisos.push(`${hit.nome}: valor por hora — estimativa com 1 hora.`);
      }
      itens.push({
        descricao: porHora ? `${hit.nome} (1 hora)` : hit.nome,
        quantidade: 1,
        valorUnitario: hit.valor,
        valorTotal: hit.valor,
        origem: 'SERVICO_ADICIONAL',
      });
    }
    return itens;
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
