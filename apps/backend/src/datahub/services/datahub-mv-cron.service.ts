import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronAlertService } from '../../common/cron/cron-alert.service';
import { DatahubMvRefreshService } from './datahub-mv-refresh.service';
import { DatahubDwStore } from '../datahub-dw.store';

@Injectable()
export class DatahubMvCronService {
  private readonly logger = new Logger(DatahubMvCronService.name);

  constructor(
    private readonly refresh: DatahubMvRefreshService,
    private readonly dw: DatahubDwStore,
    private readonly cronAlert: CronAlertService,
  ) {}

  /** Atualiza MVs do Datahub a cada 15 minutos (não bloqueia leituras com CONCURRENTLY). */
  @Cron('*/15 * * * *', { timeZone: 'America/Sao_Paulo' })
  async handleRefresh() {
    this.logger.log('CRON Datahub: refresh materialized views');
    try {
      await this.cronAlert.runSafe('datahub_mv_refresh', async () => {
        await this.refresh.refreshAll();
        await this.dw.reloadFatosFromMv(true);
      });
    } catch (err) {
      this.logger.error('CRON Datahub refresh falhou', err instanceof Error ? err.stack : err);
    }
  }
}
