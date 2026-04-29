import { Module } from '@nestjs/common';
import { AutomacaoSharedModule } from '../automacao-shared.module';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowEngineController } from './workflow-engine.controller';

@Module({
  imports: [AutomacaoSharedModule],
  providers: [WorkflowEngineService],
  controllers: [WorkflowEngineController],
  exports: [WorkflowEngineService],
})
export class WorkflowEngineModule {}
