import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AutomacaoWorkflowStore } from './stores/automacao-workflow.store';
import { AutomacaoRegrasStore } from './stores/automacao-regras.store';
import { AutomacaoRpaJobStore } from './stores/automacao-rpa-job.store';
import { AutomacaoSchedulerStore } from './stores/automacao-scheduler.store';
import { AutomacaoExecucaoStore } from './stores/automacao-execucao.store';

@Module({
  imports: [PrismaModule],
  providers: [
    AutomacaoWorkflowStore,
    AutomacaoRegrasStore,
    AutomacaoRpaJobStore,
    AutomacaoSchedulerStore,
    AutomacaoExecucaoStore,
  ],
  exports: [
    AutomacaoWorkflowStore,
    AutomacaoRegrasStore,
    AutomacaoRpaJobStore,
    AutomacaoSchedulerStore,
    AutomacaoExecucaoStore,
  ],
})
export class AutomacaoSharedModule {}
