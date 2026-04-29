import { Module } from '@nestjs/common';
import { AutomacaoSharedModule } from '../automacao-shared.module';
import { SchedulerAutomacaoController } from './scheduler-automacao.controller';

@Module({
  imports: [AutomacaoSharedModule],
  controllers: [SchedulerAutomacaoController],
})
export class SchedulerModule {}
