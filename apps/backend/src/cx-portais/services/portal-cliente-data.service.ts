import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlataformaTenantStore } from '../../plataforma-integracao/stores/plataforma-tenant.store';
import type { CxPortalRequestUser } from '../types/cx-portal.types';
import { PortalClienteSolicitacoesQueryDto } from '../dto/portal-cliente-solicitacoes-query.dto';

@Injectable()
export class PortalClienteDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: PlataformaTenantStore,
  ) {}

  private clientScope(cx: CxPortalRequestUser, clienteIdParam?: string): string {
    if (cx.portalPapel === 'STAFF') {
      if (!clienteIdParam) {
        throw new BadRequestException('Parâmetro clienteId obrigatório para visão ADMIN/GERENTE');
      }
      return clienteIdParam;
    }
    if (!cx.clienteId) {
      throw new BadRequestException('Usuário portal sem vínculo de cliente');
    }
    return cx.clienteId;
  }

  async dashboard(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = this.clientScope(cx, clienteIdParam);
    const [totalSol, abertas, concluidas, cliente] = await Promise.all([
      this.prisma.solicitacao.count({ where: { clienteId, deletedAt: null } }),
      this.prisma.solicitacao.count({
        where: { clienteId, deletedAt: null, status: { in: ['PENDENTE', 'APROVADO'] } },
      }),
      this.prisma.solicitacao.count({ where: { clienteId, deletedAt: null, status: 'CONCLUIDO' } }),
      this.prisma.cliente.findFirst({ where: { id: clienteId, deletedAt: null } }),
    ]);
    const tenant = this.tenants.obter(cx.tenantId) ?? this.tenants.obter('default');
    return {
      cliente: cliente ? { id: cliente.id, nome: cliente.nome, email: cliente.email } : null,
      solicitacoes: { total: totalSol, emAndamentoProxy: abertas, concluidas },
      meta: {
        tenantId: cx.tenantId,
        slasProxy: tenant?.config.slasHorasProxy ?? null,
        publicApiEnvelope: { success: true, data: 'Camada CX consome contratos alinhados à API pública (Fase 18) — proxy read-only.' },
      },
    };
  }

  private readonly orderFields = new Set(['createdAt', 'updatedAt', 'protocolo', 'status']);

  async listarSolicitacoesPaginado(cx: CxPortalRequestUser, q: PortalClienteSolicitacoesQueryDto) {
    const clienteId = this.clientScope(cx, q.clienteId);
    const page = q.page ?? 1;
    const rawLimit = q.limit ?? 10;
    const limit = Math.min(Math.max(1, rawLimit), 100);
    const skip = (page - 1) * limit;
    const rawOb = q.orderBy ?? 'createdAt';
    const orderBy = this.orderFields.has(rawOb) ? rawOb : 'createdAt';
    const order = q.order ?? 'desc';

    const where: Prisma.SolicitacaoWhereInput = {
      deletedAt: null,
      clienteId,
      ...(q.status ? { status: q.status } : {}),
    };
    if (q.createdFrom || q.createdTo) {
      where.createdAt = {};
      if (q.createdFrom) {
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(q.createdFrom);
      }
      if (q.createdTo) {
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(q.createdTo);
      }
    }
    const proto = q.protocolo?.trim();
    if (proto) {
      where.protocolo = { contains: proto, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.solicitacao.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: order },
        include: {
          cliente: true,
          portaria: true,
          gate: true,
          patio: true,
          saida: true,
          unidades: true,
        },
      }),
      this.prisma.solicitacao.count({ where }),
    ]);

    return { items, total, page, limit, orderBy, order };
  }

  async obterSolicitacao(cx: CxPortalRequestUser, id: string) {
    const s = await this.prisma.solicitacao.findFirst({
      where: { id, deletedAt: null },
      include: {
        portaria: true,
        gate: true,
        patio: true,
        saida: true,
        unidades: true,
      },
    });
    if (!s) return null;
    if (cx.portalPapel !== 'STAFF') {
      if (s.clienteId !== this.clientScope(cx)) return null;
    }
    return s;
  }

  async eventos(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = this.clientScope(cx, clienteIdParam);
    const sols = await this.prisma.solicitacao.findMany({
      where: { clienteId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 80,
      select: { id: true, protocolo: true, status: true, updatedAt: true },
    });
    return sols.map((s) => ({
      tipo: 'solicitacao.atualizada',
      protocolo: s.protocolo,
      status: s.status,
      atualizadoEm: s.updatedAt.toISOString(),
    }));
  }

  async faturas(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = this.clientScope(cx, clienteIdParam);
    return this.prisma.faturamento.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { itens: true },
    });
  }

  async boletos(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = this.clientScope(cx, clienteIdParam);
    return this.prisma.boleto.findMany({
      where: { faturamento: { clienteId } },
      orderBy: { dataVencimento: 'desc' },
      take: 100,
      include: { faturamento: { select: { id: true, periodo: true } } },
    });
  }

  async nfses(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = this.clientScope(cx, clienteIdParam);
    return this.prisma.nfsEmitida.findMany({
      where: { faturamento: { clienteId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        numeroNfe: true,
        statusIpm: true,
        createdAt: true,
        faturamentoId: true,
      },
    });
  }

  async slas(cx: CxPortalRequestUser) {
    const t = this.tenants.obter(cx.tenantId) ?? this.tenants.obter('default');
    return {
      tenantId: cx.tenantId,
      contratadosProxy: t?.config.slasHorasProxy ?? { gate: 4, patio: 72, saida: 24 },
      historicoProxy: [
        { periodo: '30d', cumprimentoPctProxy: 94 },
        { periodo: '90d', cumprimentoPctProxy: 91 },
      ],
    };
  }

  async kpis(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = this.clientScope(cx, clienteIdParam);
    const [cicloMedioHorasProxy, containersAtivos] = await Promise.all([
      this.prisma.solicitacao
        .findMany({
          where: { clienteId, deletedAt: null, status: 'CONCLUIDO' },
          take: 30,
          orderBy: { updatedAt: 'desc' },
          select: { createdAt: true, updatedAt: true },
        })
        .then((rows) => {
          if (!rows.length) return null;
          const avg =
            rows.reduce((a, r) => a + (r.updatedAt.getTime() - r.createdAt.getTime()) / 3600000, 0) / rows.length;
          return Math.round(avg * 10) / 10;
        }),
      this.prisma.solicitacao.count({
        where: {
          clienteId,
          deletedAt: null,
          status: { in: ['PENDENTE', 'APROVADO'] },
          saida: { is: null },
        },
      }),
    ]);
    const brandingDefaultKpis = ['ciclo_medio_horas', 'containers_ativos', 'faturamento_aberto'];
    return {
      personalizaveis: brandingDefaultKpis,
      valores: {
        ciclo_medio_horas: cicloMedioHorasProxy,
        containers_ativos: containersAtivos,
        faturamento_aberto: await this.prisma.faturamento.count({
          where: { clienteId, statusBoleto: { not: 'pago' } },
        }),
      },
    };
  }

  exportResumo(cx: CxPortalRequestUser, formato: 'json' | 'csv', clienteIdParam?: string) {
    const p = (async () => {
      const dashP = this.dashboard(cx, clienteIdParam);
      const solPageP = this.listarSolicitacoesPaginado(cx, {
        page: 1,
        limit: 200,
        orderBy: 'updatedAt',
        order: 'desc',
        ...(clienteIdParam ? { clienteId: clienteIdParam } : {}),
      });
      const [dash, solPage] = await Promise.all([dashP, solPageP]);
      return { dashboard: dash, solicitacoesSample: solPage.items.slice(0, 50) };
    })();
    return p.then((data) => {
      if (formato === 'json') return { formato: 'json', ...data };
      const csv = `tipo,info\nportal.cx,export_simulado\ncliente,${cx.sub}\n`;
      return { formato: 'csv', conteudo: csv, bytes: Buffer.byteLength(csv, 'utf8') };
    });
  }
}
