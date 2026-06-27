import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EstagioCobranca,
  StatusPagamentoFatura,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActiveTenantsService } from '../tenant/active-tenants.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import {
  CLIENTE_FINANCE_SELECT,
  diffDiasAtraso,
  resolveFinanceProfile,
} from '../common/finance/finance-profile.util';
import {
  buildDunningMessage,
  mergeReguaCobranca,
  resolveProximoEstagioCobranca,
} from '../common/finance/regua-cobranca.util';
import { NotificationEnqueueService } from '../notification/notification-enqueue.service';
import { EmailService } from '../common/email/email.service';

const OPEN_STATUSES: StatusPagamentoFatura[] = [
  StatusPagamentoFatura.PENDENTE,
  StatusPagamentoFatura.PROCESSANDO,
  StatusPagamentoFatura.AGUARDANDO_PAGAMENTO,
  StatusPagamentoFatura.VENCIDA,
];

export type DunningRunResult = {
  tenantId: string;
  scanned: number;
  notified: number;
  skipped: number;
};

@Injectable()
export class DunningProcessService {
  private readonly logger = new Logger(DunningProcessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly activeTenants: ActiveTenantsService,
    private readonly notifications: NotificationEnqueueService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async runDunningForAllTenants(asOf = new Date()): Promise<DunningRunResult[]> {
    const tenants = await this.activeTenants.listActiveTenantIds();
    const results: DunningRunResult[] = [];
    for (const tenantId of tenants) {
      results.push(await this.runDunningForTenant(tenantId, asOf));
    }
    return results;
  }

  async runDunningForTenant(tenantId: string, asOf = new Date()): Promise<DunningRunResult> {
    const { parametros } = await this.tenantConfig.getParametros(tenantId);
    const regua = mergeReguaCobranca(parametros.reguaCobranca);
    if (!regua.ativo) {
      return { tenantId, scanned: 0, notified: 0, skipped: 0 };
    }

    const faturas = await this.prisma.fatura.findMany({
      where: {
        tenantId,
        statusPagamento: { in: OPEN_STATUSES },
        dataVencimento: { not: null },
      },
      include: {
        cliente: { select: { ...CLIENTE_FINANCE_SELECT, email: true, emailNfse: true, razaoSocial: true, nomeFantasia: true } },
        preFatura: { select: { containerIso: true } },
      },
    });

    let notified = 0;
    let skipped = 0;

    for (const fatura of faturas) {
      if (!fatura.dataVencimento) {
        skipped += 1;
        continue;
      }

      const profile = resolveFinanceProfile(fatura.cliente, parametros);
      const proximo = resolveProximoEstagioCobranca({
        estagioAtual: fatura.estagioCobranca,
        dataVencimento: fatura.dataVencimento,
        diasToleranciaBloqueio: profile.diasToleranciaBloqueio,
        regua,
        asOf,
      });

      if (!proximo) {
        skipped += 1;
        continue;
      }

      const valorExibicao = Number(fatura.valorAtualizado ?? fatura.valorTotal);
      const diasAtraso = diffDiasAtraso(fatura.dataVencimento, asOf);
      const faturaNumero = fatura.numeroRps?.trim() || fatura.id.slice(0, 8).toUpperCase();
      const portalBase = this.config.get<string>('whatsapp.portalPublicBaseUrl')?.replace(/\/$/, '') ?? '';
      const portalLink = `${portalBase}/portal/financeiro/armazenagem/${fatura.id}`;
      const containerIso = fatura.preFatura?.containerIso ?? '—';
      const dedupeKey = `dunning:${fatura.id}:${proximo}`;

      const messagePreview = buildDunningMessage(proximo, {
        faturaNumero,
        valorExibicao,
        dataVencimento: fatura.dataVencimento,
        portalLink,
        diasAtraso,
      });

      await this.notifications.enqueueDunningStandalone({
        faturaId: fatura.id,
        clienteId: fatura.clienteId,
        containerIso,
        valorExibicao,
        faturaNumero,
        portalLink,
        estagio: proximo,
        dataVencimento: fatura.dataVencimento.toISOString(),
        diasAtraso,
        dedupeKey,
        messagePreview,
      });

      const emailTo = fatura.cliente.emailNfse?.trim() || fatura.cliente.email?.trim();
      if (emailTo) {
        await this.email.sendDunningNotice({
          to: emailTo,
          subject: this.emailSubjectForStage(proximo, faturaNumero),
          bodyText: messagePreview,
        });
      }

      await this.prisma.fatura.update({
        where: { id: fatura.id },
        data: { estagioCobranca: proximo },
      });

      notified += 1;
      this.logger.log(
        `Dunning ${proximo} — fatura ${fatura.id} (cliente ${fatura.clienteId})`,
      );
    }

    return { tenantId, scanned: faturas.length, notified, skipped };
  }

  private emailSubjectForStage(stage: EstagioCobranca, faturaNumero: string): string {
    switch (stage) {
      case EstagioCobranca.PRE_VENCIMENTO:
        return `RL Transportes — Fatura ${faturaNumero} vence em breve`;
      case EstagioCobranca.VENCIMENTO_HOJE:
        return `RL Transportes — Fatura ${faturaNumero} vence hoje`;
      case EstagioCobranca.ATRASO_LEVE:
        return `RL Transportes — Fatura ${faturaNumero} em aberto`;
      case EstagioCobranca.PRE_BLOQUEIO:
        return `RL Transportes — URGENTE: suspensão de serviços em 24h`;
      default:
        return `RL Transportes — Cobrança fatura ${faturaNumero}`;
    }
  }
}
