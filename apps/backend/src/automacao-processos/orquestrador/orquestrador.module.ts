import { Module } from '@nestjs/common';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { RegrasModule } from '../regras/regras.module';
import { OrquestradorAutomacaoService } from './orquestrador-automacao.service';

@Module({
  imports: [WorkflowEngineModule, RegrasModule],
  providers: [OrquestradorAutomacaoService],
})
export class OrquestradorModule {}
