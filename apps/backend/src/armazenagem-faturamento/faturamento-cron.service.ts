import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronAlertService } from '../common/cron/cron-alert.service';
import { ArmazenagemBillingService } from './armazenagem-billing.service';
import { FaturamentoMoraService } from './faturamento-mora.service';
import { HoldReleaseService } from '../hold-release/hold-release.service';
import { FaturaPacoteService } from '../fatura-pacote/fatura-pacote.service';

@Injectable()
export class FaturamentoCronService {
  private readonly logger = new Logger(FaturamentoCronService.name);

  constructor(
    private readonly billing: ArmazenagemBillingService,
    private readonly mora: FaturamentoMoraService,
    private readonly holdRelease: HoldReleaseService,
    private readonly cronAlert: CronAlertService,
    private readonly faturaPacote: FaturaPacoteService,
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
        const reconcile = await this.billing.reconcileClosedProcessoPrefaturas();
        this.logger.log(`CRON reconciliação ID encerrado: ${JSON.stringify(reconcile)}`);
        return { result, mora, holds, reconcile };
      });
    } catch (err) {
      this.logger.error('CRON provisão falhou', err instanceof Error ? err.stack : err);
    }
  }

  /** A cada 15 min: clientes no automático cuja hora já passou hoje. */
  @Cron('*/15 * * * *', { timeZone: 'America/Sao_Paulo' })
  async handleFaturaAutomatica() {
    try {
      await this.cronAlert.runSafe('fatura_pacote_automatica', async () => {
        const out = await this.faturaPacote.emitirAutomaticosNaHora();
        this.logger.log(`CRON Fatura automática: ${JSON.stringify(out)}`);
        return out;
      });
    } catch (err) {
      this.logger.error('CRON Fatura automática falhou', err instanceof Error ? err.stack : err);
    }
  }
}
