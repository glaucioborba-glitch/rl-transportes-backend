import { Module } from '@nestjs/common';
import { AutomacaoSharedModule } from '../automacao-shared.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { RegrasAutomacaoService } from './regras-automacao.service';
import { RegrasAutomacaoController } from './regras-automacao.controller';

@Module({
  imports: [AutomacaoSharedModule, WorkflowEngineModule],
  providers: [RegrasAutomacaoService],
  controllers: [RegrasAutomacaoController],
  exports: [RegrasAutomacaoService],
})
export class RegrasModule {}
