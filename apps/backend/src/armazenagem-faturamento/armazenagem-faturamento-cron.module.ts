import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronAlertModule } from '../common/cron/cron-alert.module';
import { ArmazenagemFaturamentoModule } from './armazenagem-faturamento.module';
import { FaturamentoCronService } from './faturamento-cron.service';
import { HoldReleaseModule } from '../hold-release/hold-release.module';

/** CRON noturno de armazenagem — candidato a lazy-load (H4). */
@Module({
  imports: [ScheduleModule, CronAlertModule, ArmazenagemFaturamentoModule, HoldReleaseModule],
  providers: [FaturamentoCronService],
})
export class ArmazenagemFaturamentoCronModule {}
