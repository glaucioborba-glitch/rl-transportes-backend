import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  PatioStatus,
  Prisma,
  StatusAgendamentoTerminal,
  StatusPixCreditoComprovante,
  StatusSolicitacao,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SOLICITACAO_CONTROLE_INCLUDE, protocoloBuscaWhere } from '../../solicitacoes/protocolo-solicitacao.util';
import { PlataformaTenantStore } from '../../plataforma-integracao/stores/plataforma-tenant.store';
import type { CxPortalRequestUser } from '../types/cx-portal.types';
import { PortalClienteSolicitacoesQueryDto } from '../dto/portal-cliente-solicitacoes-query.dto';
import { UpdatePortalSolicitacaoDto } from '../dto/update-portal-solicitacao.dto';
import { UpdatePortalEmbarqueDto } from '../dto/update-portal-embarque.dto';
import {
  LABEL_CAMPO_EMBARQUE,
  chaveAgrupamentoEmbarque,
  dataCampoEmbarque,
  isAlcanceEmbarque,
  isCampoEmbarque,
  normalizeValorEmbarque,
  valoresBatemAlcance,
} from '../embarque-campo.util';
import { DashboardPortalService } from '../dashboard/dashboard-portal.service';
import { AgendamentosService } from '../../agendamentos/agendamentos.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { stripContainerIsoCanonical } from '../../common/utils/data-sanitize';
import { assertClienteDoTenant } from '../portal-cliente-tenant.util';
import { estoqueClienteMatchesQuery } from '../estoque-cliente-query.util';
import { lacreEstoquePatio } from '../saldo-patio-item.util';
import {
  AUDIT_ACAO_UNIDADE_ALTERADA,
  diffSolicitacaoAuditSnapshots,
  formatAuditActorLabel,
  resolveAuditActor,
  snapshotFromPersisted,
  snapshotFromUpdateDto,
} from '../../audit-log/audit-log-solicitacao.util';
import { GateUnidadeNotificacaoService } from '../../gate-v2/gate-unidade-notificacao.service';
import {
  containerIsosChanged,
  deltasInvalidateQrCredential,
} from '../../common/utils/credencial-version.util';
import {
  formatTamanhoContainerMatrix,
  normalizeTamanhoContainer,
  normalizeTamanhosContainer,
} from '../../cadastros/tipo-container-tamanhos.util';
import { CatalogoMotoristasExternosService } from '../../catalogo-motoristas-externos/catalogo-motoristas-externos.service';
import { CatalogoNaviosService } from '../../catalogo-navios/catalogo-navios.service';
import { isCpfFrotaPlaceholder } from '../../catalogo-motoristas-externos/catalogo-motoristas-externos.util';
import { MOTIVO_CONTA_CORRENTE_LABEL, classificarSaldo, toMoneyNumber } from '../../conta-corrente/conta-corrente.util';
import { randomUUID } from 'crypto';
import { BankingBoletoService } from '../../fiscal-integracao/banking-boleto.service';
import { RetriableOutboxError } from '../../outbox/outbox.errors';
import { rotuloEmpresaCliente } from '../../audit-trail/audit-ator.util';
import { ObjectStorageService } from '../../common/storage/object-storage.service';
import { unificarFats } from '../portal-fat.util';
import { deactivateQr, qrEstaAtivo } from '../../gate-v2/operacao-fluxo-qr.util';
import type { OperacaoFluxoJson } from '../../gate-v2/operacao-states.constants';

const STATUS_TERMINAL = new Set<StatusSolicitacao>([
  StatusSolicitacao.CONCLUIDO,
  StatusSolicitacao.REJEITADO,
  StatusSolicitacao.CANCELADO,
  StatusSolicitacao.CANCELADO_CLIENTE,
]);

const STATUS_APOS_CHECKIN = new Set<StatusSolicitacao>([
  StatusSolicitacao.EM_PATIO,
  StatusSolicitacao.EM_EXECUCAO,
  StatusSolicitacao.AGUARDANDO_GATE_OUT,
]);

const STATUS_REAPROVACAO = new Set<StatusSolicitacao>([
  StatusSolicitacao.APROVADO,
  StatusSolicitacao.AGUARDANDO_GATE_IN,
]);

const FLUXO_APOS_CHEGADA = new Set([
  'CHECKIN_PORTARIA',
  'VISTORIA_FOTOGRAFICA',
  'AGUARDANDO_RECONFIRMACAO',
  'RECONFIRMADA',
  'RIC_GERADO',
  'LIBERADA_OPERACAO',
  'EM_OPERACAO',
  'CONCLUIDA',
]);

function parseFluxoJson(raw: Prisma.JsonValue | null | undefined): OperacaoFluxoJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as OperacaoFluxoJson;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function solicitanteDivergente(
  atual: { nome: string; telefone: string; email: string } | null | undefined,
  dto: { nome: string; telefone: string; email: string },
): boolean {
  if (!atual) return false;
  return (
    atual.nome.trim() !== dto.nome.trim() ||
    digitsOnly(atual.telefone) !== digitsOnly(dto.telefone) ||
    atual.email.trim().toLowerCase() !== dto.email.trim().toLowerCase()
  );
}

function containersNaoIsoMudaram(
  atuais: Array<{
    ordem: number;
    booking: string;
    processo: string;
    navio: string | null;
    tamanho: string;
    tipo: string;
    status: string;
    lacre: string | null;
    refrigerado: boolean;
    setPoint: number | null;
  }>,
  dto: Array<{
    ordem: number;
    booking?: string;
    processo?: string;
    navio?: string;
    tamanho: string;
    tipo: string;
    status: string;
    lacre?: string;
    refrigerado: boolean;
    setPoint?: number | null;
  }>,
): boolean {
  for (const c of dto) {
    const existing = atuais.find((x) => x.ordem === c.ordem);
    if (!existing) return true;
    if ((existing.booking ?? '').trim() !== (c.booking ?? '').trim()) return true;
    if ((existing.processo ?? '').trim() !== (c.processo ?? '').trim()) return true;
    if ((existing.navio ?? '').trim() !== (c.navio ?? '').trim()) return true;
    if (existing.tamanho.trim() !== c.tamanho.trim()) return true;
    if (existing.tipo.trim().toUpperCase() !== c.tipo.trim().toUpperCase()) return true;
    if (existing.status !== c.status) return true;
    if ((existing.lacre ?? '').trim() !== (c.lacre ?? '').trim()) return true;
    if (Boolean(existing.refrigerado) !== Boolean(c.refrigerado)) return true;
    const setAntes = existing.setPoint == null ? null : Number(existing.setPoint);
    const setDepois = c.setPoint == null ? null : Number(c.setPoint);
    if (setAntes !== setDepois) return true;
  }
  return false;
}

@Injectable()
export class PortalClienteDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: PlataformaTenantStore,
    private readonly dashboardPortal: DashboardPortalService,
    private readonly agendamentos: AgendamentosService,
    private readonly auditLog: AuditLogService,
    private readonly catalogoMotoristas: CatalogoMotoristasExternosService,
    private readonly catalogoNavios: CatalogoNaviosService,
    private readonly banking: BankingBoletoService,
    private readonly gateNotificacoes: GateUnidadeNotificacaoService,
    private readonly storage: ObjectStorageService,
  ) {}

  private async nomeEmpresaCx(cx: CxPortalRequestUser): Promise<string | null> {
    if (!cx.clienteId) return null;
    const c = await this.prisma.cliente.findFirst({
      where: { id: cx.clienteId, deletedAt: null },
      select: { razaoSocial: true, nomeFantasia: true },
    });
    return rotuloEmpresaCliente(c);
  }

  private async clientScope(cx: CxPortalRequestUser, clienteIdParam?: string): Promise<string> {
    if (cx.portalPapel === 'STAFF') {
      if (!clienteIdParam) {
        throw new BadRequestException('Parâmetro clienteId obrigatório para visão ADMIN/GERENTE');
      }
      return assertClienteDoTenant(this.prisma, cx.tenantId, clienteIdParam);
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
    const clienteId = await this.clientScope(cx, q.clienteId);
    const page = q.page ?? 1;
    const rawLimit = q.limit ?? 10;
    const limit = Math.min(Math.max(1, rawLimit), 100);
    const skip = (page - 1) * limit;
    const rawOb = q.orderBy ?? 'createdAt';
    const orderBy = this.orderFields.has(rawOb) ? rawOb : 'createdAt';
    const order = q.order ?? 'desc';

    const where: Prisma.SolicitacaoWhereInput = {
      deletedAt: null,
      tenantId: cx.tenantId,
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
    const protoWhere = q.protocolo?.trim() ? protocoloBuscaWhere(q.protocolo) : null;
    if (protoWhere) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        protoWhere,
      ];
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
          ...SOLICITACAO_CONTROLE_INCLUDE,
        },
      }),
      this.prisma.solicitacao.count({ where }),
    ]);

    return { items, total, page, limit, orderBy, order };
  }

  async obterSolicitacao(cx: CxPortalRequestUser, id: string) {
    const s = await this.prisma.solicitacao.findFirst({
      where: {
        id,
        deletedAt: null,
        tenantId: cx.tenantId,
        ...(cx.portalPapel === 'STAFF' ? {} : { clienteId: await this.clientScope(cx) }),
      },
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
        ...SOLICITACAO_CONTROLE_INCLUDE,
      },
    });
    if (!s) return null;
    return s;
  }

  async eventos(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = await this.clientScope(cx, clienteIdParam);
    const sols = await this.prisma.solicitacao.findMany({
      where: { clienteId, tenantId: cx.tenantId, deletedAt: null },
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
    const clienteId = await this.clientScope(cx, clienteIdParam);
    const [mensais, avulsas] = await Promise.all([
      this.prisma.faturamento.findMany({
        where: { clienteId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          periodo: true,
          valorTotal: true,
          statusNfe: true,
          statusBoleto: true,
          createdAt: true,
          itens: { select: { id: true, descricao: true, valor: true } },
          nfsEmitidas: {
            select: {
              id: true,
              numeroNfe: true,
              statusIpm: true,
              createdAt: true,
              linkNfsePdf: true,
            },
          },
          boletos: {
            select: {
              id: true,
              numeroBoleto: true,
              valorBoleto: true,
              dataVencimento: true,
              statusPagamento: true,
              linkPdf: true,
            },
          },
          solicitacoesVinculadas: {
            select: { solicitacao: { select: { id: true, protocolo: true } } },
          },
          faturasArmazenagem: {
            select: {
              id: true,
              valorTotal: true,
              statusPagamento: true,
              dataEmissao: true,
              linkNfse: true,
              linkBoleto: true,
              linkPix: true,
              preFatura: { select: { containerIso: true, diasCobrados: true } },
            },
          },
        },
      }),
      this.prisma.fatura.findMany({
        where: { clienteId, faturamentoId: null },
        orderBy: { dataEmissao: 'desc' },
        take: 100,
        select: {
          id: true,
          valorTotal: true,
          dataEmissao: true,
          createdAt: true,
          statusPagamento: true,
          linkNfse: true,
          linkBoleto: true,
          linkPix: true,
          preFatura: { select: { containerIso: true, diasCobrados: true } },
        },
      }),
    ]);
    return unificarFats(mensais, avulsas);
  }

  async contaCorrente(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = await this.clientScope(cx, clienteIdParam);
    const lancamentos = await this.prisma.clienteContaCorrenteLancamento.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const saldo = toMoneyNumber(
      lancamentos.reduce((acc, l) => acc + toMoneyNumber(l.valorSinal), 0),
    );
    const situacao = classificarSaldo(saldo);
    const situacaoLabel =
      situacao === 'CREDOR'
        ? 'Crédito a seu favor'
        : situacao === 'DEVEDOR'
          ? 'Saldo em aberto'
          : 'Saldo zerado';
    return {
      cliente: {
        saldo,
        situacao,
        situacaoLabel,
        lancamentos: lancamentos.length,
      },
      lancamentos: lancamentos.map((l) => ({
        id: l.id,
        tipo: l.tipo,
        valor: toMoneyNumber(l.valor),
        valorSinal: toMoneyNumber(l.valorSinal),
        motivo: l.motivo,
        motivoLabel: MOTIVO_CONTA_CORRENTE_LABEL[l.motivo],
        descricao: l.descricao,
        referencia: l.referencia,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  async pixCreditoContaCorrente(cx: CxPortalRequestUser, valorRaw: number, clienteIdParam?: string) {
    const clienteId = await this.clientScope(cx, clienteIdParam);
    const valor = toMoneyNumber(valorRaw);
    if (!Number.isFinite(valor) || valor < 0.01) {
      throw new BadRequestException('Informe um valor válido para o crédito.');
    }
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, tenantId: cx.tenantId },
      select: { id: true, razaoSocial: true, cpfCnpj: true, email: true, emailNfse: true },
    });
    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    const referencia = `CC-${cliente.id.replace(/-/g, '').slice(0, 12).toUpperCase()}-${Date.now()}`;
    try {
      const pix = await this.banking.gerarPixCobranca({
        referencia,
        valor,
        descricao: 'Crédito conta corrente',
        cliente,
      });
      if (!pix.pixCopiaCola) {
        throw new ServiceUnavailableException('O banco não retornou o código PIX. Tente novamente.');
      }
      return {
        valor,
        pixCopiaCola: pix.pixCopiaCola,
        pixQrCodeUrl: pix.pixQrCodeUrl,
        provedor: pix.provedor,
        sandbox: pix.sandbox,
        referenciaExterna: pix.referenciaExterna,
      };
    } catch (e) {
      if (e instanceof ServiceUnavailableException) throw e;
      if (e instanceof RetriableOutboxError) {
        throw new ServiceUnavailableException('Banco indisponível no momento. Tente novamente em instantes.');
      }
      throw e;
    }
  }

  async enviarComprovantePixCredito(
    cx: CxPortalRequestUser,
    params: {
      valorRaw: string | number;
      referenciaExterna?: string;
      file: Express.Multer.File;
    },
    clienteIdParam?: string,
  ) {
    const clienteId = await this.clientScope(cx, clienteIdParam);
    const valor = toMoneyNumber(params.valorRaw);
    if (!Number.isFinite(valor) || valor < 0.01) {
      throw new BadRequestException('Informe o valor do crédito PIX.');
    }
    const file = params.file;
    if (!file?.buffer?.length) {
      throw new BadRequestException('Anexe o comprovante do PIX (JPG, PNG ou PDF).');
    }
    const mime = (file.mimetype || '').toLowerCase();
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
    if (!allowed.has(mime)) {
      throw new BadRequestException('Envie o comprovante em JPG, PNG ou PDF.');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('O comprovante não pode passar de 5 MB.');
    }
    const originalName = (file.originalname || 'comprovante').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
    const stored = await this.storage.upload({
      key: `financeiro/pix-credito/${clienteId}/${randomUUID()}_${originalName}`,
      body: file.buffer,
      contentType: mime,
    });
    const referencia = (params.referenciaExterna ?? '').trim() || null;
    const row = await this.prisma.clientePixCreditoComprovante.create({
      data: {
        tenantId: cx.tenantId,
        clienteId,
        valor: new Prisma.Decimal(valor.toFixed(2)),
        referenciaExterna: referencia,
        arquivoNome: originalName,
        mimeType: mime,
        storageKey: stored.storageKey,
        tamanhoBytes: file.size,
        status: StatusPixCreditoComprovante.PENDENTE,
        createdBySub: cx.sub,
      },
    });
    return { ok: true as const, comprovanteId: row.id, arquivo: originalName };
  }

  /** Faturas de armazenagem (Gate-Out) com links NFS-e / boleto / PIX. */
  async faturasArmazenagem(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = await this.clientScope(cx, clienteIdParam);
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
    const clienteId = await this.clientScope(cx, clienteIdParam);
    return this.prisma.boleto.findMany({
      where: { faturamento: { clienteId } },
      orderBy: { dataVencimento: 'desc' },
      take: 100,
      include: { faturamento: { select: { id: true, periodo: true } } },
    });
  }

  async nfses(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = await this.clientScope(cx, clienteIdParam);
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
    const clienteId = await this.clientScope(cx, clienteIdParam);
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
      this.prisma.unidadeProcesso.count({
        where: {
          clienteId,
          tenantId: cx.tenantId,
          status: 'ABERTO',
          modalidade: 'PATIO',
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
      const empresaNome = await this.nomeEmpresaCx(cx);
      const actor = resolveAuditActor(cx, empresaNome);
      await this.auditLog.append(
        {
          entidadeId: id,
          entidadeTipo: 'SOLICITACAO',
          acao: 'SOLICITACAO_ALTERADA',
          usuarioId: actor.usuarioId,
          usuarioNome: actor.usuarioNome,
          usuarioRole: actor.usuarioRole,
          descricaoNarrativa: `O operador ${actor.operadorNome}${empresaNome ? ` da empresa ${empresaNome}` : ''} cancelou a solicitação.`,
          dadosAnteriores: { status: sol.status },
          dadosNovos: {
            status: StatusSolicitacao.CANCELADO_CLIENTE,
            ator: { tipo: 'cliente', empresaNome, operadorNome: actor.operadorNome },
          },
          deltas: [{ campo: 'status', label: 'Status', antes: sol.status, depois: StatusSolicitacao.CANCELADO_CLIENTE }],
        },
        tx,
      );
    });

    const updated = await this.obterSolicitacao(cx, id);
    if (!updated) throw new NotFoundException('Solicitação não encontrada');
    return updated;
  }

  async atualizarSolicitacaoPortal(cx: CxPortalRequestUser, id: string, dto: UpdatePortalSolicitacaoDto) {
    const sol = await this.prisma.solicitacao.findFirst({
      where: { id, deletedAt: null, tenantId: cx.tenantId },
      include: {
        containersSolicitacao: { orderBy: { ordem: 'asc' } },
        agendamentoSolicitacao: true,
        transporteSolicitacao: true,
        solicitanteContato: true,
      },
    });
    if (!sol) throw new NotFoundException('Solicitação não encontrada');
    if (cx.portalPapel !== 'STAFF' && sol.clienteId !== (await this.clientScope(cx))) {
      throw new NotFoundException('Solicitação não encontrada');
    }
    if (STATUS_TERMINAL.has(sol.status)) {
      throw new BadRequestException('Solicitação não editável neste status.');
    }
    if (STATUS_APOS_CHECKIN.has(sol.status) || FLUXO_APOS_CHEGADA.has(String(sol.operacaoFluxoEstado ?? ''))) {
      throw new BadRequestException('Solicitação já em operação no Gate — não é mais editável.');
    }
    if (solicitanteDivergente(sol.solicitanteContato, dto.solicitante)) {
      throw new BadRequestException('Alteração do solicitante não é permitida.');
    }
    if (!sol.agendamentoSolicitacao) {
      throw new BadRequestException('Solicitação sem agendamento vinculado.');
    }

    const dataRef = new Date(`${dto.agendamento.dataRef}T12:00:00.000Z`);
    if (Number.isNaN(dataRef.getTime())) {
      throw new BadRequestException('Data de agendamento inválida');
    }

    const tiposAtivos = await this.prisma.cadastroTipoContainer.findMany({
      where: { deletedAt: null, ativo: true },
      select: { codigo: true, tamanhos: true },
    });
    const byCodigo = new Map(
      tiposAtivos.map((t) => [t.codigo.toUpperCase(), normalizeTamanhosContainer(t.tamanhos)]),
    );

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
      const codigo = c.tipo.trim().toUpperCase();
      const tamanhos = byCodigo.get(codigo);
      if (!tamanhos) {
        throw new BadRequestException(
          `Tipo de contêiner inválido ou inativo na ordem ${c.ordem}: ${c.tipo}`,
        );
      }
      const tamanhoNorm = normalizeTamanhoContainer(c.tamanho);
      if (!tamanhos.includes(tamanhoNorm)) {
        throw new BadRequestException(
          `Tamanho ${c.tamanho} não permitido para o tipo ${codigo} (ordem ${c.ordem}).`,
        );
      }
      c.tipo = codigo;
      c.tamanho = formatTamanhoContainerMatrix(tamanhoNorm);
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
    const empresaNome = await this.nomeEmpresaCx(cx);
    const auditActor = resolveAuditActor(cx, empresaNome);
    const isosBefore = sol.containersSolicitacao.map((c) => c.unidade);
    const isosAfter = sol.containersSolicitacao.map((c) => {
      const incoming = dto.containers.find((x) => x.ordem === c.ordem);
      return incoming?.unidade?.trim() ? incoming.unidade : c.unidade;
    });
    const invalidateQr =
      deltasInvalidateQrCredential(auditDeltas) || containerIsosChanged(isosBefore, isosAfter);
    const houveAlteracao =
      auditDeltas.length > 0 ||
      containersNaoIsoMudaram(sol.containersSolicitacao, dto.containers) ||
      invalidateQr;
    const reenviarParaAutorizacao =
      houveAlteracao &&
      (STATUS_REAPROVACAO.has(sol.status) || qrEstaAtivo(parseFluxoJson(sol.operacaoFluxoJson)));

    if (dto.transporte) {
      const cpf = dto.transporte.cpfMotorista.replace(/\D/g, '');
      if (!isCpfFrotaPlaceholder(cpf)) {
        await this.catalogoMotoristas.assertNaoSuspenso(cpf);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.agendamentoSolicitacao.update({
        where: { solicitacaoId: id },
        data: {
          dataRef,
          turno: dto.agendamento.turno,
        },
      });

      for (const c of dto.containers) {
        const existing = sol.containersSolicitacao.find((x) => x.ordem === c.ordem)!;
        await tx.containerSolicitacao.update({
          where: { id: existing.id },
          data: {
            booking: (c.booking ?? '').trim(),
            processo: (c.processo ?? '').trim(),
            navio: (c.navio ?? '').trim(),
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
        { protocolo: sol.protocolo },
      );

      if (invalidateQr || reenviarParaAutorizacao) {
        await tx.solicitacao.update({
          where: { id },
          data: {
            versaoCredencial: { increment: 1 },
            ...(reenviarParaAutorizacao
              ? {
                  status: StatusSolicitacao.PENDENTE,
                  operacaoFluxoEstado: 'SOLICITADA',
                  operacaoFluxoJson: deactivateQr(parseFluxoJson(sol.operacaoFluxoJson)) as Prisma.InputJsonValue,
                }
              : {}),
          },
        });
      }
    });

    if (dto.transporte && !isCpfFrotaPlaceholder(dto.transporte.cpfMotorista.replace(/\D/g, ''))) {
      void this.catalogoMotoristas
        .registrarDaSolicitacao({
          cpf: dto.transporte.cpfMotorista,
          nome: dto.transporte.nomeMotorista,
          origem: 'PORTAL',
        })
        .catch(() => undefined);
    }

    void this.catalogoNavios
      .registrarMuitos(
        dto.containers.map((c) => c.navio),
        'SOLICITACAO',
      )
      .catch(() => undefined);

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

  /**
   * Única lista de estoque do portal: ID aberto deste cliente.
   * Saldo no pátio, lupa de coleta/exportação e simulação leem isto.
   */
  private async unidadesComIdAberto(clienteId: string, tenantId: string) {
    const agora = Date.now();
    const processos = await this.prisma.unidadeProcesso.findMany({
      where: { clienteId, tenantId, status: 'ABERTO', modalidade: 'PATIO' },
      include: {
        entradaSolicitacao: {
          select: {
            id: true,
            protocolo: true,
            containersSolicitacao: {
              select: {
                unidade: true,
                booking: true,
                processo: true,
                navio: true,
                tamanho: true,
                tipo: true,
                status: true,
                refrigerado: true,
                lacre: true,
                setPoint: true,
              },
            },
          },
        },
        patioUnidades: {
          select: { id: true, refrigerado: true, status: true },
          take: 1,
        },
      },
      orderBy: { entradaEm: 'asc' },
    });

    return processos.map((p) => {
      const patio = p.patioUnidades[0];
      return mapSaldoPatioItem({
        id: patio?.id ?? p.id,
        unidadeIso: p.unidadeIso,
        entradaEm: p.entradaEm,
        agora,
        refrigerado: patio?.refrigerado ?? false,
        statusPatioCodigo: patio?.status ?? PatioStatus.ESTOCADO,
        protocolo: p.entradaSolicitacao?.protocolo ?? `ID-${p.numero}`,
        solicitacaoId: p.entradaSolicitacao?.id ?? '',
        containers: p.entradaSolicitacao?.containersSolicitacao ?? [],
        unidadeProcessoNumero: p.numero,
        lacreSaida: p.lacreSaida,
      });
    });
  }

  /**
   * Altera booking, processo ou navio da unidade depositada (ID aberto).
   * Alcance: só esta unidade, ou todas do mesmo processo / booking / navio.
   * Não reabre a solicitação nem invalida QR — só o dado de embarque.
   */
  async atualizarEmbarquePatio(cx: CxPortalRequestUser, dto: UpdatePortalEmbarqueDto) {
    if (!isCampoEmbarque(dto.campo)) {
      throw new BadRequestException('Campo inválido. Use booking, processo ou navio.');
    }
    const alcance = isAlcanceEmbarque(dto.alcance) ? dto.alcance : 'unidade';
    const campo = dto.campo;
    const valor = normalizeValorEmbarque(campo, dto.valor);
    const clienteId = await this.clientScope(cx);
    const iso = stripContainerIsoCanonical(dto.unidadeIso);
    if (!iso) throw new BadRequestException('Unidade inválida.');

    const depositados = await this.prisma.unidadeProcesso.findMany({
      where: {
        clienteId,
        tenantId: cx.tenantId,
        status: 'ABERTO',
        modalidade: 'PATIO',
      },
      include: {
        entradaSolicitacao: {
          select: {
            id: true,
            protocolo: true,
            containersSolicitacao: true,
          },
        },
      },
    });

    const origem = depositados.find(
      (p) =>
        p.entradaSolicitacaoId === dto.solicitacaoId &&
        stripContainerIsoCanonical(p.unidadeIso) === iso,
    );
    if (!origem?.entradaSolicitacao) {
      throw new NotFoundException('Unidade depositada não encontrada.');
    }
    const containerOrigem = matchContainerByIso(
      origem.unidadeIso,
      origem.entradaSolicitacao.containersSolicitacao,
    );
    if (!containerOrigem) {
      throw new NotFoundException('Dados de embarque da unidade não encontrados.');
    }

    let chaveGrupo = '';
    if (alcance !== 'unidade') {
      chaveGrupo = chaveAgrupamentoEmbarque(alcance, containerOrigem[alcance]);
      if (!chaveGrupo) {
        throw new BadRequestException(
          `Não há ${LABEL_CAMPO_EMBARQUE[alcance].toLowerCase()} nesta unidade para aplicar em lote.`,
        );
      }
    }

    const alvos = depositados.flatMap((p) => {
      if (!p.entradaSolicitacao) return [];
      const container = matchContainerByIso(
        p.unidadeIso,
        p.entradaSolicitacao.containersSolicitacao,
      );
      if (!container) return [];
      if (alcance === 'unidade') {
        return stripContainerIsoCanonical(p.unidadeIso) === iso ? [{ processo: p, container }] : [];
      }
      return valoresBatemAlcance(alcance, chaveGrupo, container)
        ? [{ processo: p, container }]
        : [];
    });

    if (alvos.length === 0) {
      throw new NotFoundException('Nenhuma unidade depositada encontrada para este alcance.');
    }

    const label = LABEL_CAMPO_EMBARQUE[campo];
    const empresaNome = await this.nomeEmpresaCx(cx);
    const actor = resolveAuditActor(cx, empresaNome);
    const atorLabel = formatAuditActorLabel(actor.usuarioRole, actor.operadorNome, actor.empresaNome);
    const dataCampo = dataCampoEmbarque(campo, valor);

    let atualizadas = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const alvo of alvos) {
        const antes = String(alvo.container[campo] ?? '').trim();
        const antesNorm = campo === 'navio' ? antes.toUpperCase() : antes;
        if (antesNorm === valor) continue;
        await tx.containerSolicitacao.update({
          where: { id: alvo.container.id },
          data: dataCampo,
        });
        await this.auditLog.append(
          {
            entidadeId: alvo.processo.entradaSolicitacao!.id,
            acao: AUDIT_ACAO_UNIDADE_ALTERADA,
            usuarioId: actor.usuarioId,
            usuarioNome: actor.usuarioNome,
            usuarioRole: actor.usuarioRole,
            containerIso: alvo.processo.unidadeIso,
            descricaoNarrativa: `${atorLabel} alterou ${label} da unidade ${alvo.processo.unidadeIso}.`,
            dadosAnteriores: { [campo]: antes },
            dadosNovos: {
              [campo]: valor,
              alcance,
              ator: {
                tipo: 'cliente',
                empresaNome: actor.empresaNome,
                operadorNome: actor.operadorNome,
              },
            },
            deltas: [{ campo, label, antes, depois: valor }],
            tenantId: cx.tenantId,
          },
          tx,
        );
        await this.gateNotificacoes.registrar(
          {
            tenantId: cx.tenantId,
            unidadeProcessoId: alvo.processo.id,
            unidadeIso: alvo.processo.unidadeIso,
            processoNumero: alvo.processo.numero,
            origem: 'PORTAL',
            atorNome: atorLabel,
            atorRole: actor.usuarioRole,
            campos: [{ campo, label, antes, depois: valor }],
          },
          tx,
        );
        atualizadas += 1;
      }
    });

    if (campo === 'navio' && valor) {
      void this.catalogoNavios.registrar(valor, 'SOLICITACAO').catch(() => undefined);
    }

    return {
      atualizadas,
      alcance,
      booking: campo === 'booking' ? valor : containerOrigem.booking,
      processo: campo === 'processo' ? valor : containerOrigem.processo,
      navio: campo === 'navio' ? valor : containerOrigem.navio,
    };
  }

  /** Unidades depositadas no pátio (ID aberto). */
  async saldoPatio(cx: CxPortalRequestUser, clienteIdParam?: string) {
    const clienteId = await this.clientScope(cx, clienteIdParam);
    const items = await this.unidadesComIdAberto(clienteId, cx.tenantId);
    return {
      total: items.length,
      cheios: items.filter((i) => i.statusContainer === 'CHEIO').length,
      vazios: items.filter((i) => i.statusContainer === 'VAZIO').length,
      refrigerados: items.filter((i) => i.refrigerado).length,
      atualizadoEm: new Date().toISOString(),
      items,
    };
  }

  /**
   * Estoque para coleta/exportação: a mesma lista do saldo no pátio (ID aberto).
   * Operador/pessoa autorizada não amplia o conjunto.
   */
  async listarEstoqueDoCliente(cx: CxPortalRequestUser, q?: string, clienteIdParam?: string) {
    const clienteId =
      cx.portalPapel === 'STAFF'
        ? await this.clientScope(cx, clienteIdParam)
        : await this.clientScope(cx);

    const items = (await this.unidadesComIdAberto(clienteId, cx.tenantId)).filter((item) =>
      estoqueClienteMatchesQuery(
        {
          unidadeIso: item.unidadeIso,
          numero: item.unidadeProcessoNumero ?? 0,
          protocolo: item.protocolo,
          booking: item.booking,
          processo: item.processo,
          navio: item.navio,
        },
        q ?? '',
      ),
    );

    return { total: items.length, atualizadoEm: new Date().toISOString(), items };
  }
}

type SaldoPatioContainerRef = {
  unidade: string;
  booking: string;
  processo: string;
  navio?: string;
  tamanho: string;
  tipo: string;
  status: string;
  refrigerado: boolean;
  lacre?: string | null;
  setPoint?: number | null;
};

function matchContainerByIso<T extends { unidade: string }>(iso: string, containers: T[]): T | undefined {
  const key = stripContainerIsoCanonical(iso);
  return containers.find((c) => stripContainerIsoCanonical(c.unidade) === key);
}

function labelStatusPatioCliente(status: PatioStatus): string {
  if (status === PatioStatus.MOVIMENTANDO) return 'Em movimentação';
  if (status === PatioStatus.AGUARDANDO_GATE_OUT) return 'Aguardando saída';
  return 'Depositado';
}

function mapSaldoPatioItem(input: {
  id: string;
  unidadeIso: string;
  entradaEm: Date;
  agora: number;
  refrigerado: boolean;
  statusPatioCodigo: PatioStatus;
  protocolo: string;
  solicitacaoId: string;
  containers: SaldoPatioContainerRef[];
  unidadeProcessoNumero?: number;
  lacreSaida?: string | null;
}) {
  const c = matchContainerByIso(input.unidadeIso, input.containers);
  const statusContainer = c?.status === 'VAZIO' ? 'VAZIO' : c?.status === 'CHEIO' ? 'CHEIO' : null;
  const lacre = lacreEstoquePatio(statusContainer, c?.lacre, input.lacreSaida);
  return {
    id: input.id,
    unidadeIso: input.unidadeIso,
    tipo: c?.tipo?.trim() || (input.refrigerado || c?.refrigerado ? 'REEFER' : 'DRY'),
    tamanho: c?.tamanho?.trim() || null,
    statusContainer,
    refrigerado: Boolean(input.refrigerado || c?.refrigerado),
    booking: c?.booking?.trim() || null,
    processo: c?.processo?.trim() || null,
    navio: c?.navio?.trim() || null,
    lacre,
    setPoint: c?.setPoint ?? null,
    unidadeProcessoNumero: input.unidadeProcessoNumero ?? null,
    unidadeProcessoLabel: input.unidadeProcessoNumero
      ? `ID ${input.unidadeProcessoNumero}`
      : null,
    protocolo: input.protocolo,
    solicitacaoId: input.solicitacaoId,
    statusPatio: labelStatusPatioCliente(input.statusPatioCodigo),
    statusPatioCodigo: input.statusPatioCodigo,
    entradaEm: input.entradaEm.toISOString(),
    diasNoPatio: Math.max(0, Math.floor((input.agora - input.entradaEm.getTime()) / 86_400_000)),
  };
}
