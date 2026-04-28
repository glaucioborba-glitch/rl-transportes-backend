import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardPerformanceController } from './dashboard-performance.controller';
import { DashboardPerformanceService } from './dashboard-performance.service';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardPerformanceController],
  providers: [DashboardPerformanceService],
  exports: [DashboardPerformanceService],
})
export class DashboardPerformanceModule {}
