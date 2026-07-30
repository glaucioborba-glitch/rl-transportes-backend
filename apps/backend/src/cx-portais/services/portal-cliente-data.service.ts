import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusAgendamentoTerminal, StatusSolicitacao, type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlataformaTenantStore } from '../../plataforma-integracao/stores/plataforma-tenant.store';
import type { CxPortalRequestUser } from '../types/cx-portal.types';
import { PortalClienteSolicitacoesQueryDto } from '../dto/portal-cliente-solicitacoes-query.dto';
import { UpdatePortalSolicitacaoDto } from '../dto/update-portal-solicitacao.dto';
import { DashboardPortalService } from '../dashboard/dashboard-portal.service';
import { AgendamentosService } from '../../agendamentos/agendamentos.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { stripContainerIsoCanonical } from '../../common/utils/data-sanitize';
import {
  diffSolicitacaoAuditSnapshots,
  resolveAuditActor,
  snapshotFromPersisted,
  snapshotFromUpdateDto,
} from '../../audit-log/audit-log-solicitacao.util';
import {
  containerIsosChanged,
  deltasInvalidateQrCredential,
} from '../../common/utils/credencial-version.util';

const STATUS_TERMINAL = new Set<StatusSolicitacao>([
  StatusSolicitacao.CONCLUIDO,
  StatusSolicitacao.REJEITADO,
  StatusSolicitacao.CANCELADO,
  StatusSolicitacao.CANCELADO_CLIENTE,
]);

@Injectable()
export class PortalClienteDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: PlataformaTenantStore,
    private readonly dashboardPortal: DashboardPortalService,
    private readonly agendamentos: AgendamentosService,
    private readonly auditLog: AuditLogService,
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
    return this.dashboardPortal.buildConsolidated(cx, clienteIdParam);
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
    const containerRaw = q.container?.trim();
    if (containerRaw) {
      const container = containerRaw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (container) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          {
            OR: [
              {
                containersSolicitacao: {
                  some: { unidade: { contains: container, mode: 'insensitive' } },
                },
              },
              {
                unidades: {
                  some: { numeroIso: { contains: container, mode: 'insensitive' } },
                },
              },
            ],
          },
        ];
      }
    }
    const bookingRaw = q.booking?.trim();
    if (bookingRaw) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          containersSolicitacao: {
            some: { booking: { contains: bookingRaw, mode: 'insensitive' } },
          },
        },
      ];
    }
    const processoRaw = q.processo?.trim();
    if (processoRaw) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          containersSolicitacao: {
            some: { processo: { contains: processoRaw, mode: 'insensitive' } },
          },
        },
      ];
    }

    if (q.escopo === 'minhas') {
      const email = (
        cx.pessoaAutorizada?.email?.trim() ||
        cx.email?.trim() ||
        ''
      ).toLowerCase();
      if (!email) {
        return { items: [], total: 0, page, limit, orderBy, order };
      }
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          solicitanteContato: {
            is: { email: { equals: email, mode: 'insensitive' } },
          },
        },
      ];
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
          transporteSolicitacao: true,
          containersSolicitacao: { orderBy: { ordem: 'asc' } },
          agendamentoSolicitacao: true,
          solicitanteContato: true,
          anexosSolicitacao: { orderBy: { createdAt: 'desc' } },
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
        cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        transporteSolicitacao: true,
        containersSolicitacao: { orderBy: { ordem: 'asc' } },
        agendamentoSolicitacao: true,
        solicitanteContato: true,
        anexosSolicitacao: { orderBy: { createdAt: 'desc' } },
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

  /** Faturas de armazenagem (Gate-Out) com links NFS-e / boleto / PIX. */
  async faturasArmazenagem(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = this.clientScope(cx, clienteIdParam);
    return this.prisma.fatura.findMany({
      where: { clienteId },
      orderBy: { dataEmissao: 'desc' },
      take: 100,
      select: {
        id: true,
        valorTotal: true,
        dataEmissao: true,
        statusPagamento: true,
        linkNfse: true,
        linkBoleto: true,
        linkPix: true,
        numeroRps: true,
        serieRps: true,
        preFatura: { select: { containerIso: true, diasCobrados: true } },
      },
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
    const t = (await this.tenants.obter(cx.tenantId)) ?? (await this.tenants.obter('default'));
    return {
      tenantId: cx.tenantId,
      contratadosProxy: t?.config.slasMinutosMeta ?? { gate: 240, patio: 4320, saida: 1440 },
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

  async cancelarSolicitacaoPortal(cx: CxPortalRequestUser, id: string) {
    const sol = await this.obterSolicitacao(cx, id);
    if (!sol) throw new NotFoundException('Solicitação não encontrada');
    if (STATUS_TERMINAL.has(sol.status)) {
      throw new BadRequestException('Solicitação não pode ser cancelada neste status.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.solicitacao.update({
        where: { id },
        data: { status: StatusSolicitacao.CANCELADO_CLIENTE },
      });
      await tx.agendamentoTerminal.updateMany({
        where: { solicitacaoId: id },
        data: { status: StatusAgendamentoTerminal.CANCELADO_CLIENTE },
      });
    });

    const updated = await this.obterSolicitacao(cx, id);
    if (!updated) throw new NotFoundException('Solicitação não encontrada');
    return updated;
  }

  async atualizarSolicitacaoPortal(cx: CxPortalRequestUser, id: string, dto: UpdatePortalSolicitacaoDto) {
    const sol = await this.prisma.solicitacao.findFirst({
      where: { id, deletedAt: null },
      include: {
        containersSolicitacao: { orderBy: { ordem: 'asc' } },
        agendamentoSolicitacao: true,
        transporteSolicitacao: true,
        solicitanteContato: true,
      },
    });
    if (!sol) throw new NotFoundException('Solicitação não encontrada');
    if (cx.portalPapel !== 'STAFF' && sol.clienteId !== this.clientScope(cx)) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    if (STATUS_TERMINAL.has(sol.status)) {
      throw new BadRequestException('Solicitação não editável neste status.');
    }
    if (!sol.agendamentoSolicitacao) {
      throw new BadRequestException('Solicitação sem agendamento vinculado.');
    }

    const dataRef = new Date(`${dto.agendamento.dataRef}T00:00:00.000Z`);
    if (Number.isNaN(dataRef.getTime())) {
      throw new BadRequestException('Data de agendamento inválida');
    }

    for (const c of dto.containers) {
      const existing = sol.containersSolicitacao.find((x) => x.ordem === c.ordem);
      if (!existing) {
        throw new BadRequestException(`Contêiner ordem ${c.ordem} não encontrado`);
      }
      // ISO imutável — se enviado, só bloqueia quando o valor canônico for diferente (ignora máscara).
      if (c.unidade?.trim()) {
        const incoming = stripContainerIsoCanonical(c.unidade);
        const current = stripContainerIsoCanonical(existing.unidade);
        if (incoming !== current) {
          throw new BadRequestException('Alteração do número ISO do contêiner não é permitida.');
        }
      }
    }

    const oldAg = sol.agendamentoSolicitacao;
    const oldDateStr = oldAg.dataRef.toISOString().slice(0, 10);
    const scheduleChanged =
      oldDateStr !== dto.agendamento.dataRef || oldAg.turno !== dto.agendamento.turno;
    if (scheduleChanged) {
      await this.agendamentos.assertCapacidadeTurno(
        dto.agendamento.dataRef,
        dto.agendamento.turno,
        sol.containersSolicitacao.length,
      );
    }

    const beforeSnap = snapshotFromPersisted(sol);
    const transporteDto =
      dto.transporte && sol.transporteSolicitacao
        ? dto.transporte
        : sol.transporteSolicitacao
          ? {
              nomeMotorista: sol.transporteSolicitacao.nomeMotorista,
              cpfMotorista: sol.transporteSolicitacao.cpfMotorista,
              placaCavalo: sol.transporteSolicitacao.placaCavalo,
              placaCarreta01: sol.transporteSolicitacao.placaCarreta01,
              placaCarreta02: sol.transporteSolicitacao.placaCarreta02,
            }
          : undefined;
    const afterSnap = snapshotFromUpdateDto({
      agendamento: dto.agendamento,
      ...(transporteDto ? { transporte: transporteDto } : {}),
    });
    const auditDeltas = diffSolicitacaoAuditSnapshots(beforeSnap, afterSnap);
    const auditActor = resolveAuditActor(cx);
    const isosBefore = sol.containersSolicitacao.map((c) => c.unidade);
    const isosAfter = sol.containersSolicitacao.map((c) => {
      const incoming = dto.containers.find((x) => x.ordem === c.ordem);
      return incoming?.unidade?.trim() ? incoming.unidade : c.unidade;
    });
    const invalidateQr =
      deltasInvalidateQrCredential(auditDeltas) || containerIsosChanged(isosBefore, isosAfter);

    await this.prisma.$transaction(async (tx) => {
      await tx.agendamentoSolicitacao.update({
        where: { solicitacaoId: id },
        data: {
          dataRef,
          turno: dto.agendamento.turno,
          atendimentoEspecial: dto.agendamento.atendimentoEspecial,
          atendimentoEspecialTexto: dto.agendamento.atendimentoEspecialTexto?.trim() || null,
        },
      });

      for (const c of dto.containers) {
        const existing = sol.containersSolicitacao.find((x) => x.ordem === c.ordem)!;
        await tx.containerSolicitacao.update({
          where: { id: existing.id },
          data: {
            booking: (c.booking ?? '').trim(),
            processo: (c.processo ?? '').trim(),
            tamanho: c.tamanho.trim(),
            tipo: c.tipo.trim(),
            status: c.status,
            lacre: c.lacre?.trim() || null,
            refrigerado: c.refrigerado,
            setPoint: c.setPoint ?? null,
          },
        });
      }

      if (dto.transporte && sol.transporteSolicitacao) {
        await tx.transporteSolicitacao.update({
          where: { solicitacaoId: id },
          data: {
            nomeMotorista: dto.transporte.nomeMotorista.trim(),
            cpfMotorista: dto.transporte.cpfMotorista.replace(/\D/g, ''),
            tipoCaminhao: dto.transporte.tipoCaminhao,
            placaCavalo: dto.transporte.placaCavalo.trim().toUpperCase(),
            placaCarreta01: dto.transporte.placaCarreta01.trim().toUpperCase(),
            placaCarreta02: dto.transporte.placaCarreta02?.trim().toUpperCase() || null,
          },
        });
      }

      await tx.solicitanteContato.update({
        where: { solicitacaoId: id },
        data: {
          nome: dto.solicitante.nome.trim(),
          telefone: dto.solicitante.telefone.replace(/\D/g, ''),
          email: dto.solicitante.email.trim().toLowerCase(),
        },
      });

      await tx.agendamentoTerminal.updateMany({
        where: { solicitacaoId: id },
        data: {
          dataRef,
          turno: dto.agendamento.turno,
          localOrigem: dto.localOrigem?.trim() || null,
          localDestino: dto.localDestino?.trim() || null,
        },
      });

      await this.auditLog.appendSolicitacaoUpdate(
        id,
        auditActor,
        beforeSnap,
        afterSnap,
        auditDeltas,
        tx,
      );

      if (invalidateQr) {
        await tx.solicitacao.update({
          where: { id },
          data: { versaoCredencial: { increment: 1 } },
        });
      }
    });

    const updated = await this.obterSolicitacao(cx, id);
    if (!updated) throw new NotFoundException('Solicitação não encontrada');
    return updated;
  }

  async historicoAlteracoesSolicitacao(cx: CxPortalRequestUser, id: string) {
    const sol = await this.obterSolicitacao(cx, id);
    if (!sol) throw new NotFoundException('Solicitação não encontrada');
    const logs = await this.auditLog.listBySolicitacao(id, { cx });
    return { solicitacaoId: id, items: this.auditLog.serializeForUi(logs) };
  }
}
