import { Module } from '@nestjs/common';
import { BiAnalyticsModule } from '../bi-analytics/bi-analytics.module';
import { DatahubModule } from '../datahub/datahub.module';
import { ReadModelsRefreshService } from './read-models-refresh.service';

@Module({
  imports: [BiAnalyticsModule, DatahubModule],
  providers: [ReadModelsRefreshService],
  exports: [ReadModelsRefreshService],
})
export class ReadModelsModule {}
