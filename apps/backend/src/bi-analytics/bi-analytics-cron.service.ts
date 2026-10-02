import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronAlertService } from '../common/cron/cron-alert.service';
import { BiAnalyticsRefreshService } from './bi-analytics.service';

@Injectable()
export class BiAnalyticsCronService {
  private readonly logger = new Logger(BiAnalyticsCronService.name);

  constructor(
    private readonly refresh: BiAnalyticsRefreshService,
    private readonly cronAlert: CronAlertService,
  ) {}

  @Cron('*/15 * * * *', { timeZone: 'America/Sao_Paulo' })
  async handleRefresh() {
    this.logger.log('CRON BI: refresh materialized views');
    try {
      await this.cronAlert.runSafe('bi_mv_refresh', () => this.refresh.refreshAll());
    } catch (err) {
      this.logger.error('CRON BI refresh falhou', err instanceof Error ? err.stack : err);
    }
  }
}
