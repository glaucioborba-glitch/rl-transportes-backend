import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PlataformaApiClient } from './plataforma.types';
import { PlataformaTenantStore } from './stores/plataforma-tenant.store';

@Injectable()
export class PlataformaPublicDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: PlataformaTenantStore,
  ) {}

  /** `clienteIds` = restrict; undefined = todos os clientes ativos. */
  private filtroCliente(
    tenantId: string | undefined,
    client: PlataformaApiClient,
  ): { in: string[] } | undefined {
    const t = this.tenants.obter(tenantId ?? client.tenantId ?? 'default');
    const tIds = t?.clienteIds?.length ? t.clienteIds : undefined;
    const kIds = client.clienteIds?.length ? client.clienteIds : undefined;
    let merged: string[] | undefined;
    if (tIds && kIds) merged = kIds.filter((id) => tIds.includes(id));
    else merged = tIds ?? kIds;
    if (!merged?.length) return undefined;
    return { in: merged };
  }

  async listarSolicitacoes(
    client: PlataformaApiClient,
    tenantId: string | undefined,
    page = 1,
    limit = 20,
  ) {
    const take = Math.min(Math.max(1, limit), 100);
    const skip = (Math.max(1, page) - 1) * take;
    const filtro = this.filtroCliente(tenantId, client);
    const where = {
      deletedAt: null,
      ...(filtro ? { clienteId: filtro } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.solicitacao.count({ where }),
      this.prisma.solicitacao.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          protocolo: true,
          clienteId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    return { total, page, limit: take, itens: rows };
  }

  async obterSolicitacao(id: string, client: PlataformaApiClient, tenantId: string | undefined) {
    const filtro = this.filtroCliente(tenantId, client);
    const row = await this.prisma.solicitacao.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(filtro ? { clienteId: filtro } : {}),
      },
      include: {
        portaria: true,
        gate: { select: { id: true, ricAssinado: true, createdAt: true } },
        patio: { select: { id: true, quadra: true, fileira: true, posicao: true, createdAt: true } },
        saida: { select: { id: true, dataHoraSaida: true } },
        unidades: { select: { id: true, numeroIso: true, tipo: true } },
      },
    });
    return row;
  }

  async listarEventos(_client: PlataformaApiClient, _tenantId: string | undefined, take = 50) {
    const lim = Math.min(take, 100);
    const rows = await this.prisma.auditoria.findMany({
      orderBy: { createdAt: 'desc' },
      take: lim,
      select: {
        id: true,
        tabela: true,
        acao: true,
        createdAt: true,
        registroId: true,
      },
    });
    return {
      fonte: 'auditoria_readonly_proxy',
      itens: rows,
    };
  }

  async slasProxy(client: PlataformaApiClient, tenantId: string | undefined) {
    const t = this.tenants.obter(tenantId ?? client.tenantId ?? 'default');
    const desde = new Date();
    desde.setDate(desde.getDate() - 30);
    const filtro = this.filtroCliente(tenantId, client);
    const total = await this.prisma.solicitacao.count({
      where: { deletedAt: null, updatedAt: { gte: desde }, ...(filtro ? { clienteId: filtro } : {}) },
    });
    const concl = await this.prisma.solicitacao.count({
      where: {
        deletedAt: null,
        status: 'CONCLUIDO',
        updatedAt: { gte: desde },
        ...(filtro ? { clienteId: filtro } : {}),
      },
    });
    return {
      janelaDias: 30,
      slaConfigUsuario: t?.config.slasHorasProxy ?? {},
      taxaConclusaoProxy: total ? Math.round((concl / total) * 1000) / 1000 : 0,
      observacao: 'SLA-as-a-service — métricas agregadas read-only (Fase 18).',
    };
  }

  async listarContainers(client: PlataformaApiClient, tenantId: string | undefined, take = 40) {
    const filtro = this.filtroCliente(tenantId, client);
    const unidades = await this.prisma.unidade.findMany({
      where: {
        solicitacao: {
          deletedAt: null,
          ...(filtro ? { clienteId: filtro } : {}),
        },
      },
      take: Math.min(take, 150),
      orderBy: { createdAt: 'desc' },
      include: {
        solicitacao: {
          select: { id: true, protocolo: true, clienteId: true, status: true },
        },
      },
    });
    return { itens: unidades };
  }

  async patioTempoReal(client: PlataformaApiClient, tenantId: string | undefined) {
    const filtro = this.filtroCliente(tenantId, client);
    const patios = await this.prisma.patio.findMany({
      where: {
        solicitacao: {
          deletedAt: null,
          ...(filtro ? { clienteId: filtro } : {}),
        },
      },
      take: 200,
      orderBy: { updatedAt: 'desc' },
      include: {
        solicitacao: { select: { protocolo: true, clienteId: true, status: true } },
      },
    });
    return {
      geradoEm: new Date().toISOString(),
      ocupacaoSlots: patios.length,
      itens: patios,
    };
  }

  async operacoesResumo(client: PlataformaApiClient, tenantId: string | undefined) {
    const filtro = this.filtroCliente(tenantId, client);
    const solWhere: { deletedAt: null; clienteId?: { in: string[] } } = {
      deletedAt: null,
      ...(filtro ? { clienteId: filtro } : {}),
    };
    const [portaria, gate, patio, saida, cicloRows] = await Promise.all([
      this.prisma.portaria.count({
        where: { solicitacao: solWhere },
      }),
      this.prisma.gate.count({ where: { solicitacao: solWhere } }),
      this.prisma.patio.count({ where: { solicitacao: solWhere } }),
      this.prisma.saida.count({ where: { solicitacao: solWhere } }),
      this.prisma.solicitacao.findMany({
        where: { ...solWhere, status: 'CONCLUIDO' },
        take: 500,
        select: { createdAt: true, updatedAt: true },
      }),
    ]);
    let cicloMedioDias = 0;
    if (cicloRows.length) {
      const sum = cicloRows.reduce(
        (a, r) => a + (r.updatedAt.getTime() - r.createdAt.getTime()) / 86400000,
        0,
      );
      cicloMedioDias = Math.round((sum / cicloRows.length) * 100) / 100;
    }
    return {
      contagemEtapas: { portaria, gate, patio, saida },
      cicloOperacionalMedioDiasProxy: cicloMedioDias,
      produtividadeProxy: {
        throughputMixed: portaria + gate + patio + saida,
      },
    };
  }

  async listarNfse(client: PlataformaApiClient, tenantId: string | undefined, take = 30) {
    const filtro = this.filtroCliente(tenantId, client);
    const where = filtro ? { faturamento: { clienteId: filtro } } : {};
    const rows = await this.prisma.nfsEmitida.findMany({
      where,
      take: Math.min(take, 100),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        faturamentoId: true,
        numeroNfe: true,
        statusIpm: true,
        createdAt: true,
        faturamento: { select: { clienteId: true, periodo: true, valorTotal: true } },
      },
    });
    return { itens: rows };
  }

  async listarFaturamento(client: PlataformaApiClient, tenantId: string | undefined, take = 30) {
    const filtro = this.filtroCliente(tenantId, client);
    const rows = await this.prisma.faturamento.findMany({
      where: {
        ...(filtro ? { clienteId: filtro } : {}),
      },
      take: Math.min(take, 100),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        clienteId: true,
        periodo: true,
        valorTotal: true,
        createdAt: true,
        boletos: {
          select: { id: true, statusPagamento: true, valorBoleto: true, dataVencimento: true },
          take: 20,
        },
      },
    });
    return { itens: rows };
  }
}
