import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronAlertService } from '../../common/cron/cron-alert.service';
import { IntegracaoEventLogStore } from '../stores/integracao-event-log.store';

@Injectable()
export class IntegracaoEventLogCleanupService implements OnModuleInit {
  private readonly logger = new Logger(IntegracaoEventLogCleanupService.name);

  constructor(
    private readonly store: IntegracaoEventLogStore,
    private readonly cronAlert: CronAlertService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Integracao event log cleanup CRON registrado (03:30 diário, TTL 90d)');
  }

  @Cron('30 3 * * *')
  async runDailyCleanup(): Promise<void> {
    await this.cronAlert.runSafe('integracao_event_log_cleanup', async () => {
      const deleted = await this.store.cleanupOlderThan(90);
      this.logger.log(`Cleanup integração: ${deleted} eventos >90d removidos`);
    });
  }
}
