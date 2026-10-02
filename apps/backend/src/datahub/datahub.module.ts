import { Module } from '@nestjs/common';
import { CronAlertModule } from '../common/cron/cron-alert.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ObservabilidadeModule } from '../observabilidade/observabilidade.module';
import { IaOperacionalModule } from '../ia-operacional/ia-operacional.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DatahubController } from './datahub.controller';
import { DatahubDwStore } from './datahub-dw.store';
import { DatahubEtlStore } from './datahub-etl.store';
import { DatahubLakeStore } from './datahub-lake.store';
import { DatahubPipelineGuard } from './guards/datahub-pipeline.guard';
import { DatahubBiService } from './services/datahub-bi.service';
import { DatahubDwService } from './services/datahub-dw.service';
import { DatahubEtlService } from './services/datahub-etl.service';
import { DatahubMvCronService } from './services/datahub-mv-cron.service';
import { DatahubMvRefreshService } from './services/datahub-mv-refresh.service';
import { DatahubExportService } from './services/datahub-export.service';
import { DatahubLakeService } from './services/datahub-lake.service';
import { DatahubPipelineObsService } from './services/datahub-pipeline-obs.service';
import { DatahubQualityService } from './services/datahub-quality.service';

@Module({
  imports: [PrismaModule, ScheduleModule, CronAlertModule, ObservabilidadeModule, IaOperacionalModule],
  controllers: [DatahubController],
  providers: [
    DatahubLakeStore,
    DatahubDwStore,
    DatahubEtlStore,
    DatahubLakeService,
    DatahubDwService,
    DatahubEtlService,
    DatahubMvRefreshService,
    DatahubMvCronService,
    DatahubQualityService,
    DatahubBiService,
    DatahubExportService,
    DatahubPipelineObsService,
    DatahubPipelineGuard,
  ],
})
export class DatahubModule {}
