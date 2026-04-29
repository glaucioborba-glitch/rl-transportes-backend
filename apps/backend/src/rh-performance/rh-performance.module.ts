import { Module } from '@nestjs/common';
import { RhPerformanceAccessGuard } from './rh-performance-access.guard';
import { RhPerformanceController } from './rh-performance.controller';
import { RhPerformanceService } from './rh-performance.service';
import { RhPerformanceStoreService } from './rh-performance-store.service';

@Module({
  controllers: [RhPerformanceController],
  providers: [RhPerformanceService, RhPerformanceStoreService, RhPerformanceAccessGuard],
})
export class RhPerformanceModule {}
