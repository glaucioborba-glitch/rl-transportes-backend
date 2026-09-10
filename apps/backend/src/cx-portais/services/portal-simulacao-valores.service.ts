import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoriaItemTabelaPreco, PatioStatus, StatusSolicitacao } from '@prisma/client';
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
  pickOperacaoItem,
} from '../portal-simulacao-valores.util';
import { resolveCadastroTabelaVigente } from '../../cadastros/cadastro-tabela-preco-vigente';

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
  ) {}

  async catalogo(cx: CxPortalRequestUser, clienteIdParam?: string, unidadeId?: string) {
    const saldo = await this.patio.saldoPatio(cx, clienteIdParam);
    const clienteId = await this.resolveClienteId(cx, clienteIdParam);
    const unidade = unidadeId
      ? saldo.items.find((i) => i.id === unidadeId || i.unidadeIso === unidadeId)
      : undefined;
    const servicos = await this.listarServicos(clienteId, unidade);
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
    const extras = await this.precificarExtras(
      clienteId,
      unidade,
      dto.servicos ?? [],
      avisos,
    );
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

  private async listarServicos(
    clienteId: string,
    unidade?: { tipo: string; tamanho: string | null; refrigerado: boolean },
  ): Promise<PortalSimulacaoServico[]> {
    const tabela = await this.loadTabelaVigente(clienteId);
    if (!tabela) return [];

    const tipos = await this.prisma.cadastroTipoOperacao.findMany({
      where: { deletedAt: null },
      select: { codigo: true, nome: true, descricao: true },
    });
    const nomeByCodigo = new Map(tipos.map((t) => [normalizeOperacaoCodigo(t.codigo), t]));

    const extras = tabela.itens.filter(
      (i) =>
        i.categoriaItem === CategoriaItemTabelaPreco.OPERACAO &&
        isServicoAdicionalCodigo(i.tipoOperacaoCodigo),
    );
    const seen = new Set<string>();
    const out: PortalSimulacaoServico[] = [];
    for (const item of extras) {
      const codigo = normalizeOperacaoCodigo(item.tipoOperacaoCodigo);
      if (seen.has(codigo)) continue;
      seen.add(codigo);
      const cadastro = nomeByCodigo.get(codigo);
      const priced = unidade
        ? pickOperacaoItem(
            extras.map((i) => ({
              tipoOperacaoCodigo: i.tipoOperacaoCodigo,
              tipoContainerCodigo: i.tipoContainerCodigo,
              containerTamanho: i.containerTamanho,
              valor: Number(i.valor),
              unidade: i.unidade,
            })),
            codigo,
            unidade.tipo,
            unidade.tamanho,
            unidade.refrigerado,
          )
        : null;
      out.push({
        codigo,
        nome: cadastro?.nome ?? codigo,
        descricao: cadastro?.descricao ?? null,
        unidadeCobranca: priced?.unidade ?? item.unidade,
        unidadeCobrancaLabel: labelUnidadeCobranca(priced?.unidade ?? item.unidade),
        valorEstimado: priced ? Number(priced.valor) : null,
      });
    }
    return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  private async precificarExtras(
    clienteId: string,
    unidade: { tipo: string; tamanho: string | null; refrigerado: boolean },
    servicos: string[],
    avisos: string[],
  ): Promise<PortalSimulacaoItem[]> {
    const wanted = [...new Set(servicos.map(normalizeOperacaoCodigo).filter(isServicoAdicionalCodigo))];
    if (!wanted.length) return [];

    const tabela = await this.loadTabelaVigente(clienteId);
    if (!tabela) {
      avisos.push('Não há tabela de preços vigente para os serviços adicionais.');
      return [];
    }

    const extras = tabela.itens
      .filter(
        (i) =>
          i.categoriaItem === CategoriaItemTabelaPreco.OPERACAO &&
          isServicoAdicionalCodigo(i.tipoOperacaoCodigo),
      )
      .map((i) => ({
        tipoOperacaoCodigo: i.tipoOperacaoCodigo,
        tipoContainerCodigo: i.tipoContainerCodigo,
        containerTamanho: i.containerTamanho,
        valor: Number(i.valor),
        unidade: i.unidade,
      }));

    const tipos = await this.prisma.cadastroTipoOperacao.findMany({
      where: { deletedAt: null },
      select: { codigo: true, nome: true },
    });
    const nomeByCodigo = new Map(tipos.map((t) => [normalizeOperacaoCodigo(t.codigo), t.nome]));

    const itens: PortalSimulacaoItem[] = [];
    for (const codigo of wanted) {
      const hit = pickOperacaoItem(extras, codigo, unidade.tipo, unidade.tamanho, unidade.refrigerado);
      if (!hit) {
        avisos.push(`Sem preço vigente para ${nomeByCodigo.get(codigo) ?? codigo} nesta unidade.`);
        continue;
      }
      const nome = nomeByCodigo.get(codigo) ?? codigo;
      const porHora = hit.unidade.toUpperCase() === 'POR_HORA';
      if (porHora) {
        avisos.push(`${nome}: valor por hora — estimativa com 1 hora.`);
      }
      itens.push({
        descricao: porHora ? `${nome} (1 hora)` : nome,
        quantidade: 1,
        valorUnitario: hit.valor,
        valorTotal: hit.valor,
        origem: 'SERVICO_ADICIONAL',
      });
    }
    return itens;
  }

  private async loadTabelaVigente(clienteId: string) {
    return resolveCadastroTabelaVigente(this.prisma, clienteId);
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
