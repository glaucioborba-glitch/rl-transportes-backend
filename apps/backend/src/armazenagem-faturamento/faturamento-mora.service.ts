import { Injectable, Logger } from '@nestjs/common';
import { Prisma, StatusPagamentoFatura } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import {
  CLIENTE_FINANCE_SELECT,
  FinanceProfileResolved,
  resolveFinanceProfile,
} from '../common/finance/finance-profile.util';
import { calcularMora } from '../common/finance/mora-calculator.util';
import { BOLETO_STATUS } from '../common/finance/boleto-status.constants';
import { ActiveTenantsService } from '../tenant/active-tenants.service';

const BOLETO_PAGO = [BOLETO_STATUS.PAGO, 'PAGO'];
const BOLETO_CANCELADO = [BOLETO_STATUS.CANCELADO, 'CANCELADO'];

@Injectable()
export class FaturamentoMoraService {
  private readonly logger = new Logger(FaturamentoMoraService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly activeTenants: ActiveTenantsService,
  ) {}

  /** CRON diário — multa/juros para todos os tenants ativos. */
  async applyDailyMoraUpdatesForAllTenants() {
    const tenantIds = await this.activeTenants.listActiveTenantIds();
    const summaries = [];
    for (const tenantId of tenantIds) {
      summaries.push(await this.applyDailyMoraUpdates(tenantId));
    }
    this.logger.log(
      `CRON mora multi-tenant: ${tenantIds.length} tenant(s) processado(s)`,
    );
    return { tenants: tenantIds.length, summaries };
  }

  /** CRON diário — multa/juros em boletos e faturas vencidas (um tenant). */
  async applyDailyMoraUpdates(tenantId = 'default') {
    const { parametros } = await this.tenantConfig.getParametros(tenantId);
    const now = new Date();
    const profileCache = new Map<string, FinanceProfileResolved>();

    const profileFor = (clienteId: string, cliente: Prisma.ClienteGetPayload<{
      select: typeof CLIENTE_FINANCE_SELECT;
    }>) => {
      let cached = profileCache.get(clienteId);
      if (!cached) {
        cached = resolveFinanceProfile(cliente, parametros);
        profileCache.set(clienteId, cached);
      }
      return cached;
    };

    let boletosAtualizados = 0;
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
      const mora = calcularMora({
        valorOriginal: Number(boleto.valorBoleto),
        dataVencimento: boleto.dataVencimento,
        asOf: now,
        ...profileFor(boleto.faturamento.clienteId, boleto.faturamento.cliente),
      });

      if (mora.diasAtraso === 0 && boleto.valorAtualizado == null) continue;

      await this.prisma.boleto.update({
        where: { id: boleto.id },
        data: {
          valorAtualizado: mora.valorAtualizado,
          statusPagamento: mora.diasAtraso > 0 ? BOLETO_STATUS.VENCIDO : boleto.statusPagamento,
        },
      });
      boletosAtualizados++;
    }

    let faturasAtualizadas = 0;
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
      let dataVencimento = fatura.dataVencimento;
      if (!dataVencimento && fatura.faturamento?.boletos[0]) {
        dataVencimento = fatura.faturamento.boletos[0].dataVencimento;
      }
      if (!dataVencimento) continue;

      const mora = calcularMora({
        valorOriginal: Number(fatura.valorTotal),
        dataVencimento,
        asOf: now,
        ...profileFor(fatura.clienteId, fatura.cliente),
      });

      const patch: Prisma.FaturaUpdateInput = {
        valorAtualizado: mora.valorAtualizado,
      };
      if (!fatura.dataVencimento) patch.dataVencimento = dataVencimento;
      if (
        mora.diasAtraso > 0 &&
        fatura.statusPagamento === StatusPagamentoFatura.AGUARDANDO_PAGAMENTO
      ) {
        patch.statusPagamento = StatusPagamentoFatura.VENCIDA;
      }

      await this.prisma.fatura.update({ where: { id: fatura.id }, data: patch });
      faturasAtualizadas++;
    }

    const summary = { boletosAtualizados, faturasAtualizadas, tenantId };
    this.logger.log(`CRON mora diária: ${JSON.stringify(summary)}`);
    return summary;
  }
}
