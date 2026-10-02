import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertService } from '../alert/alert.service';
import { DbHealthService } from './db-health.service';

@Injectable()
export class HealthAlertService {
  private readonly logger = new Logger(HealthAlertService.name);

  constructor(
    private readonly dbHealth: DbHealthService,
    private readonly alerts: AlertService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async monitorDbHealth(): Promise<void> {
    try {
      const status = await this.dbHealth.checkConnection();

      if (status.status === 'unhealthy') {
        await this.alerts.dbUnavailable({
          latencyMs: status.latencyMs,
          activeConnections: status.activeConnections,
        });
        return;
      }

      if (status.status === 'degraded' && (status.activeConnections ?? 0) > 40) {
        await this.alerts.poolDegraded({
          latencyMs: status.latencyMs,
          activeConnections: status.activeConnections ?? 0,
        });
      }
    } catch (e) {
      this.logger.warn(`monitorDbHealth falhou: ${(e as Error).message}`);
    }
  }
}
