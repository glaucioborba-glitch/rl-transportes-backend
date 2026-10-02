import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronAlertService } from '../../common/cron/cron-alert.service';
import { MobileHubOpsStore } from './mobile-hub-ops.store';
import { MobileTelemetryStore } from './mobile-telemetry.store';

@Injectable()
export class MobileTelemetryCleanupService {
  private readonly logger = new Logger(MobileTelemetryCleanupService.name);

  constructor(
    private readonly telemetryStore: MobileTelemetryStore,
    private readonly hubOpsStore: MobileHubOpsStore,
    private readonly cronAlert: CronAlertService,
  ) {}

  /** Diário 03:00 — telemetria >7d, hub-ops >90d. */
  @Cron('0 3 * * *', { timeZone: 'America/Sao_Paulo' })
  async runDailyCleanup() {
    try {
      await this.cronAlert.runSafe('mobile_telemetry_cleanup', async () => {
        const telDeleted = await this.telemetryStore.cleanupOlderThan(7);
        const opsDeleted = await this.hubOpsStore.cleanupOlderThan(90);
        this.logger.log(
          `Cleanup mobile: ${telDeleted} telemetrias >7d, ${opsDeleted} hub-ops >90d removidos`,
        );
        return { telDeleted, opsDeleted };
      });
    } catch (err) {
      this.logger.error('CRON mobile cleanup falhou', err instanceof Error ? err.stack : err);
    }
  }
}
