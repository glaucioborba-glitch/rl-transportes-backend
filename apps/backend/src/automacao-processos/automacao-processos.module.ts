import { Module } from '@nestjs/common';
import { AutomacaoSharedModule } from './automacao-shared.module';
import { WorkflowEngineModule } from './workflow-engine/workflow-engine.module';
import { RPAModule } from './rpa/rpa.module';
import { RegrasModule } from './regras/regras.module';
import { OrquestradorModule } from './orquestrador/orquestrador.module';
import { EstadoOperacionalModule } from './estado-operacional/estado-operacional.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { DashboardAutomacaoModule } from './dashboard/dashboard-automacao.module';

/**
 * Fase 19 — Automação de processos: workflows, RPA, regras, estados, scheduler, dashboard e orquestrador ligado ao barramento da Fase 14.
 * Persistência em memória (sem migrations nesta fase).
 */
@Module({
  imports: [
    AutomacaoSharedModule,
    WorkflowEngineModule,
    RPAModule,
    RegrasModule,
    OrquestradorModule,
    EstadoOperacionalModule,
    SchedulerModule,
    DashboardAutomacaoModule,
  ],
})
export class AutomacaoProcessosModule {}
