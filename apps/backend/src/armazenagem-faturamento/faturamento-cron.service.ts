import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronAlertService } from '../common/cron/cron-alert.service';
import { ArmazenagemBillingService } from './armazenagem-billing.service';
import { FaturamentoMoraService } from './faturamento-mora.service';
import { HoldReleaseService } from '../hold-release/hold-release.service';

@Injectable()
export class FaturamentoCronService {
  private readonly logger = new Logger(FaturamentoCronService.name);

  constructor(
    private readonly billing: ArmazenagemBillingService,
    private readonly mora: FaturamentoMoraService,
    private readonly holdRelease: HoldReleaseService,
    private readonly cronAlert: CronAlertService,
  ) {}

  /** CRON noturno — contêineres EM_PATIO via pré-faturas abertas (gate-in sem gate-out). */
  @Cron('1 0 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleDailyProvision() {
    this.logger.log('Iniciando CRON de provisão diária (Billing Rule Engine)');
    try {
      await this.cronAlert.runSafe('faturamento_daily_provision', async () => {
        const result = await this.billing.runDailyProvision();
        this.logger.log(`CRON provisão concluída: ${JSON.stringify(result)}`);
        const mora = await this.mora.applyDailyMoraUpdatesForAllTenants();
        this.logger.log(`CRON mora/juros: ${JSON.stringify(mora)}`);
        const holds = await this.holdRelease.syncFinancialHoldsForAllTenants();
        this.logger.log(`CRON hold financeiro: ${JSON.stringify(holds)}`);
        return { result, mora, holds };
      });
    } catch (err) {
      this.logger.error('CRON provisão falhou', err instanceof Error ? err.stack : err);
    }
  }
}
