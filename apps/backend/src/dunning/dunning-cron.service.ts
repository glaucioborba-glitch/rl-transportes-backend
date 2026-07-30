import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronAlertService } from '../common/cron/cron-alert.service';
import { DunningProcessService } from './dunning-process.service';

@Injectable()
export class DunningCronService {
  private readonly logger = new Logger(DunningCronService.name);

  constructor(
    private readonly dunning: DunningProcessService,
    private readonly cronAlert: CronAlertService,
  ) {}

  /** Régua de cobrança — 08:00 America/Sao_Paulo (preventivo + inadimplência). */
  @Cron('0 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleDailyDunning() {
    this.logger.log('Iniciando CRON da régua de cobrança (Dunning Process)');
    try {
      await this.cronAlert.runSafe('dunning_daily', async () => {
        const results = await this.dunning.runDunningForAllTenants();
        const totalNotified = results.reduce((s, r) => s + r.notified, 0);
        this.logger.log(
          `CRON Dunning concluído — ${results.length} tenant(s), ${totalNotified} notificação(ões)`,
        );
        return { tenants: results.length, totalNotified };
      });
    } catch (err) {
      this.logger.error(
        `Falha no CRON Dunning: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
