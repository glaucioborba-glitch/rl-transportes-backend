import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardFinanceiroController } from './dashboard-financeiro.controller';
import { DashboardFinanceiroService } from './dashboard-financeiro.service';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardFinanceiroController],
  providers: [DashboardFinanceiroService],
  exports: [DashboardFinanceiroService],
})
export class DashboardFinanceiroModule {}
