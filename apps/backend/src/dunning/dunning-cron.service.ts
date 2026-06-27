import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DunningProcessService } from './dunning-process.service';

@Injectable()
export class DunningCronService {
  private readonly logger = new Logger(DunningCronService.name);

  constructor(private readonly dunning: DunningProcessService) {}

  /** Régua de cobrança — 08:00 America/Sao_Paulo (preventivo + inadimplência). */
  @Cron('0 8 * * *', { timeZone: 'America/Sao_Paulo' })
  async handleDailyDunning() {
    this.logger.log('Iniciando CRON da régua de cobrança (Dunning Process)');
    try {
      const results = await this.dunning.runDunningForAllTenants();
      const totalNotified = results.reduce((s, r) => s + r.notified, 0);
      this.logger.log(
        `CRON Dunning concluído — ${results.length} tenant(s), ${totalNotified} notificação(ões)`,
      );
    } catch (err) {
      this.logger.error(
        `Falha no CRON Dunning: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
