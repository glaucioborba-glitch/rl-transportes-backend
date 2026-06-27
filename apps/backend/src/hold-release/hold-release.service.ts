import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  StatusBloqueioContainer,
  StatusPagamentoFatura,
  StatusSolicitacao,
  TipoBloqueioContainer,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { PRISMA_SERIALIZABLE_TX } from '../prisma/transaction-options';
import {
  CLIENTE_FINANCE_SELECT,
  FinanceProfileResolved,
  inadimplenciaExcedeTolerancia,
  resolveFinanceProfile,
} from '../common/finance/finance-profile.util';
import { BOLETO_STATUS } from '../common/finance/boleto-status.constants';
import { ActiveTenantsService } from '../tenant/active-tenants.service';

const SISTEMA = 'SISTEMA';
const BOLETO_PAGO = [BOLETO_STATUS.PAGO, 'PAGO'];
const BOLETO_CANCELADO = [BOLETO_STATUS.CANCELADO, 'CANCELADO'];

export type BloqueioContainerRow = {
  id: string;
  tipo: TipoBloqueioContainer;
  motivo: string;
  status: StatusBloqueioContainer;
  bloqueadoPorId: string;
  dataBloqueio: string;
  liberadoPorId: string | null;
  dataLiberacao: string | null;
};

@Injectable()
export class HoldReleaseService {
  private readonly logger = new Logger(HoldReleaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly activeTenants: ActiveTenantsService,
  ) {}

  formatBloqueioMessage(tipo: TipoBloqueioContainer, motivo: string): string {
    return `ACESSO NEGADO. Unidade possui bloqueio ativo do tipo ${tipo}. Motivo: ${motivo}. Procure a administração.`;
  }

  async findBloqueioAtivo(solicitacaoId: string) {
    return this.prisma.bloqueioContainer.findFirst({
      where: { solicitacaoId, status: StatusBloqueioContainer.ATIVO },
      orderBy: { dataBloqueio: 'desc' },
    });
  }

  async assertSemBloqueioAtivo(solicitacaoId: string): Promise<void> {
    const bloqueio = await this.findBloqueioAtivo(solicitacaoId);
    if (bloqueio) {
      throw new ForbiddenException(this.formatBloqueioMessage(bloqueio.tipo, bloqueio.motivo));
    }
  }

  async listAtivosBySolicitacao(solicitacaoId: string): Promise<BloqueioContainerRow[]> {
    const rows = await this.prisma.bloqueioContainer.findMany({
      where: { solicitacaoId, status: StatusBloqueioContainer.ATIVO },
      orderBy: { dataBloqueio: 'desc' },
    });
    return rows.map((r) => this.toRow(r));
  }

  private toRow(r: {
    id: string;
    tipo: TipoBloqueioContainer;
    motivo: string;
    status: StatusBloqueioContainer;
    bloqueadoPorId: string;
    dataBloqueio: Date;
    liberadoPorId: string | null;
    dataLiberacao: Date | null;
  }): BloqueioContainerRow {
    return {
      id: r.id,
      tipo: r.tipo,
      motivo: r.motivo,
      status: r.status,
      bloqueadoPorId: r.bloqueadoPorId,
      dataBloqueio: r.dataBloqueio.toISOString(),
      liberadoPorId: r.liberadoPorId,
      dataLiberacao: r.dataLiberacao?.toISOString() ?? null,
    };
  }

  private async syncUnidadeFlags(tx: Prisma.TransactionClient, solicitacaoId: string) {
    const ativo = await tx.bloqueioContainer.findFirst({
      where: { solicitacaoId, status: StatusBloqueioContainer.ATIVO },
      orderBy: { dataBloqueio: 'desc' },
    });
    await tx.unidade.updateMany({
      where: { solicitacaoId },
      data: ativo
        ? {
            movimentacaoBloqueada: true,
            bloqueioMotivo: ativo.motivo,
            bloqueioTipo: ativo.tipo,
          }
        : {
            movimentacaoBloqueada: false,
            bloqueioMotivo: null,
            bloqueioTipo: null,
          },
    });
  }

  async aplicarBloqueio(params: {
    solicitacaoId: string;
    tipo: TipoBloqueioContainer;
    motivo: string;
    bloqueadoPorId: string;
    referenciaId?: string;
    skipIfSameTipoAtivo?: boolean;
  }) {
    const motivo = params.motivo.trim();
    if (!motivo) throw new BadRequestException('Motivo do bloqueio é obrigatório');

    const sol = await this.prisma.solicitacao.findFirst({
      where: { id: params.solicitacaoId, deletedAt: null },
      select: { id: true, tenantId: true },
    });
    if (!sol) throw new NotFoundException('Solicitação não encontrada');

    if (params.skipIfSameTipoAtivo) {
      const exists = await this.prisma.bloqueioContainer.findFirst({
        where: {
          solicitacaoId: sol.id,
          status: StatusBloqueioContainer.ATIVO,
          tipo: params.tipo,
        },
      });
      if (exists) return this.toRow(exists);
    }

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.bloqueioContainer.create({
        data: {
          tenantId: sol.tenantId,
          solicitacaoId: sol.id,
          tipo: params.tipo,
          motivo,
          bloqueadoPorId: params.bloqueadoPorId,
          referenciaId: params.referenciaId ?? null,
        },
      });
      await this.syncUnidadeFlags(tx, sol.id);
      return this.toRow(row);
    }, PRISMA_SERIALIZABLE_TX);
  }

  async liberarBloqueio(bloqueioId: string, liberadoPorId: string) {
    const current = await this.prisma.bloqueioContainer.findUnique({ where: { id: bloqueioId } });
    if (!current) throw new NotFoundException('Bloqueio não encontrado');
    if (current.status === StatusBloqueioContainer.LIBERADO) {
      throw new BadRequestException('Bloqueio já liberado');
    }

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.bloqueioContainer.update({
        where: { id: bloqueioId },
        data: {
          status: StatusBloqueioContainer.LIBERADO,
          liberadoPorId,
          dataLiberacao: new Date(),
        },
      });
      await this.syncUnidadeFlags(tx, current.solicitacaoId);
      return this.toRow(row);
    }, PRISMA_SERIALIZABLE_TX);
  }

  /** CRON noturno — hold financeiro para todos os tenants ativos. */
  async syncFinancialHoldsForAllTenants() {
    const tenantIds = await this.activeTenants.listActiveTenantIds();
    const summaries = [];
    for (const tenantId of tenantIds) {
      summaries.push(await this.syncFinancialHoldsFromInadimplencia(tenantId));
    }
    this.logger.log(
      `Hold financeiro multi-tenant: ${tenantIds.length} tenant(s) processado(s)`,
    );
    return { tenants: tenantIds.length, summaries };
  }

  /** CRON noturno — bloqueia solicitações EM_PATIO de clientes inadimplentes (tolerância por cliente). */
  async syncFinancialHoldsFromInadimplencia(tenantId = 'default') {
    const { parametros } = await this.tenantConfig.getParametros(tenantId);
    const now = new Date();
    const profileCache = new Map<string, FinanceProfileResolved>();
    const clientesInadimplentes = new Set<string>();

    const markIfOverdue = (
      clienteId: string,
      cliente: Parameters<typeof resolveFinanceProfile>[0],
      dataVencimento: Date,
    ) => {
      let profile = profileCache.get(clienteId);
      if (!profile) {
        profile = resolveFinanceProfile(cliente, parametros);
        profileCache.set(clienteId, profile);
      }
      if (inadimplenciaExcedeTolerancia(dataVencimento, profile.diasToleranciaBloqueio, now)) {
        clientesInadimplentes.add(clienteId);
      }
    };

    const boletos = await this.prisma.boleto.findMany({
      where: {
        statusPagamento: { notIn: [...BOLETO_PAGO, ...BOLETO_CANCELADO] },
        faturamento: { tenantId },
      },
      include: {
        faturamento: {
          select: {
            clienteId: true,
            cliente: { select: CLIENTE_FINANCE_SELECT },
          },
        },
      },
    });

    for (const boleto of boletos) {
      markIfOverdue(
        boleto.faturamento.clienteId,
        boleto.faturamento.cliente,
        boleto.dataVencimento,
      );
    }

    const faturas = await this.prisma.fatura.findMany({
      where: {
        tenantId,
        statusPagamento: {
          in: [StatusPagamentoFatura.AGUARDANDO_PAGAMENTO, StatusPagamentoFatura.VENCIDA],
        },
      },
      include: {
        cliente: { select: CLIENTE_FINANCE_SELECT },
        faturamento: {
          select: {
            boletos: { orderBy: { dataVencimento: 'desc' }, take: 1 },
          },
        },
      },
    });

    for (const fatura of faturas) {
      const dataVencimento =
        fatura.dataVencimento ?? fatura.faturamento?.boletos[0]?.dataVencimento;
      if (!dataVencimento) continue;
      markIfOverdue(fatura.clienteId, fatura.cliente, dataVencimento);
    }

    let criados = 0;

    for (const clienteId of clientesInadimplentes) {
      const profile = profileCache.get(clienteId)!;
      const solicitacoes = await this.prisma.solicitacao.findMany({
        where: {
          clienteId,
          tenantId,
          deletedAt: null,
          status: { in: [StatusSolicitacao.EM_PATIO, StatusSolicitacao.AGUARDANDO_GATE_OUT] },
        },
        select: { id: true },
      });

      for (const sol of solicitacoes) {
        const before = await this.findBloqueioAtivo(sol.id);
        await this.aplicarBloqueio({
          solicitacaoId: sol.id,
          tipo: TipoBloqueioContainer.FINANCEIRO,
          motivo: `Inadimplência: título(s) vencido(s) há mais de ${profile.diasToleranciaBloqueio} dias (regra do cliente).`,
          bloqueadoPorId: SISTEMA,
          skipIfSameTipoAtivo: true,
        });
        const after = await this.findBloqueioAtivo(sol.id);
        if (!before && after?.tipo === TipoBloqueioContainer.FINANCEIRO) criados++;
      }
    }

    this.logger.log(
      `Hold financeiro CRON tenant=${tenantId} clientes=${clientesInadimplentes.size} novos=${criados}`,
    );
    return {
      clientes: clientesInadimplentes.size,
      novosBloqueios: criados,
    };
  }

  async releaseFinancialHoldsForCliente(clienteId: string, liberadoPorId: string) {
    const solicitacaoIds = await this.prisma.solicitacao.findMany({
      where: { clienteId, deletedAt: null },
      select: { id: true },
    });

    let liberados = 0;
    for (const { id } of solicitacaoIds) {
      const result = await this.prisma.bloqueioContainer.updateMany({
        where: {
          solicitacaoId: id,
          status: StatusBloqueioContainer.ATIVO,
          tipo: TipoBloqueioContainer.FINANCEIRO,
        },
        data: {
          status: StatusBloqueioContainer.LIBERADO,
          liberadoPorId,
          dataLiberacao: new Date(),
        },
      });
      if (result.count > 0) {
        liberados += result.count;
        await this.prisma.$transaction(async (tx) => {
          await this.syncUnidadeFlags(tx, id);
        });
      }
    }

    if (liberados > 0) {
      this.logger.log(`Hold financeiro liberado cliente=${clienteId} count=${liberados}`);
    }
    return { liberados };
  }

  /**
   * Cliente com bloqueio financeiro ativo (Hold Engine) ou inadimplência além da tolerância individual.
   * Usado pelo dashboard do portal para suspender agendamentos.
   */
  async isClienteBloqueadoFinanceiramente(
    clienteId: string,
    tenantId = 'default',
  ): Promise<boolean> {
    const activeBlock = await this.prisma.bloqueioContainer.findFirst({
      where: {
        status: StatusBloqueioContainer.ATIVO,
        tipo: TipoBloqueioContainer.FINANCEIRO,
        solicitacao: { clienteId, deletedAt: null },
      },
      select: { id: true },
    });
    if (activeBlock) return true;

    return this.clientePossuiInadimplenciaAtiva(clienteId, tenantId);
  }

  /**
   * Verifica títulos vencidos além da tolerância (sem considerar bloqueio ativo).
   */
  async clientePossuiInadimplenciaAtiva(clienteId: string, tenantId = 'default'): Promise<boolean> {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, tenantId, deletedAt: null },
      select: CLIENTE_FINANCE_SELECT,
    });
    if (!cliente) return false;

    const { parametros } = await this.tenantConfig.getParametros(tenantId);
    const profile = resolveFinanceProfile(cliente, parametros);
    const now = new Date();

    const boletoOverdue = await this.prisma.boleto.findMany({
      where: {
        statusPagamento: { notIn: [...BOLETO_PAGO, ...BOLETO_CANCELADO] },
        faturamento: { clienteId, tenantId },
      },
      select: { dataVencimento: true },
    });
    if (
      boletoOverdue.some((b) =>
        inadimplenciaExcedeTolerancia(b.dataVencimento, profile.diasToleranciaBloqueio, now),
      )
    ) {
      return true;
    }

    const faturas = await this.prisma.fatura.findMany({
      where: {
        clienteId,
        tenantId,
        statusPagamento: {
          in: [StatusPagamentoFatura.AGUARDANDO_PAGAMENTO, StatusPagamentoFatura.VENCIDA],
        },
      },
      select: {
        dataVencimento: true,
        faturamento: {
          select: {
            boletos: { orderBy: { dataVencimento: 'desc' }, take: 1, select: { dataVencimento: true } },
          },
        },
      },
    });

    return faturas.some((f) => {
      const venc = f.dataVencimento ?? f.faturamento?.boletos[0]?.dataVencimento;
      return venc
        ? inadimplenciaExcedeTolerancia(venc, profile.diasToleranciaBloqueio, now)
        : false;
    });
  }

  /**
   * STP pós-conciliação CNAB: libera holds financeiros se o cliente não tiver mais títulos vencidos.
   */
  async liberarBloqueioFinanceiro(
    clienteId: string,
    tenantId = 'default',
    liberadoPorId = SISTEMA,
  ): Promise<{ liberados: number; motivo?: string }> {
    const inadimplente = await this.clientePossuiInadimplenciaAtiva(clienteId, tenantId);
    if (inadimplente) {
      return { liberados: 0, motivo: 'Cliente ainda possui títulos vencidos' };
    }
    return this.releaseFinancialHoldsForCliente(clienteId, liberadoPorId);
  }
}
