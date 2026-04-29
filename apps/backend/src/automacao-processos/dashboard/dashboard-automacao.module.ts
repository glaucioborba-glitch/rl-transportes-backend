import { Module } from '@nestjs/common';
import { AutomacaoSharedModule } from '../automacao-shared.module';
import { DashboardAutomacaoService } from './dashboard-automacao.service';
import { DashboardAutomacaoController } from './dashboard-automacao.controller';

@Module({
  imports: [AutomacaoSharedModule],
  providers: [DashboardAutomacaoService],
  controllers: [DashboardAutomacaoController],
})
export class DashboardAutomacaoModule {}
