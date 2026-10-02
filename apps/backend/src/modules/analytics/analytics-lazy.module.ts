import { Module } from '@nestjs/common';
import { AnalyticsLazyController } from './analytics-lazy.controller';
import { AnalyticsLazyLoaderService } from './analytics-lazy-loader.service';

/** Lazy-load do bundle BI — rotas carregadas via POST /admin/platform/analytics-lazy/warmup. */
@Module({
  controllers: [AnalyticsLazyController],
  providers: [AnalyticsLazyLoaderService],
  exports: [AnalyticsLazyLoaderService],
})
export class AnalyticsLazyModule {}
