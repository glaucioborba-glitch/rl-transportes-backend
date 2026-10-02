import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PrismaModule, CacheModule.register({ ttl: 300_000 })],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
