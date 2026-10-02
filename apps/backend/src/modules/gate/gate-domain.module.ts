import { Module } from '@nestjs/common';
import { AgendamentosModule } from '../../agendamentos/agendamentos.module';
import { ChaosGateModule } from '../../chaos/chaos-gate.module';
import { DashboardModule } from '../../dashboard/dashboard.module';
import { DispatchModule } from '../../dispatch/dispatch.module';
import { FretesModule } from '../../fretes/fretes.module';
import { GateV2Module } from '../../gate-v2/gate.module';
import { CessaoTitularidadeModule } from '../../cessao-titularidade/cessao-titularidade.module';
import { PdfOperacionalV2Module } from '../../pdf-operacional-v2/pdf-operacional-v2.module';

/**
 * Bounded Context — Portaria (Gate).
 * QR Code, check-in/out, OCR/EIR, triagem de agendamentos.
 */
@Module({
  imports: [
    GateV2Module,
    CessaoTitularidadeModule,
    ChaosGateModule,
    AgendamentosModule,
    PdfOperacionalV2Module,
    DispatchModule,
    FretesModule,
    DashboardModule,
  ],
  exports: [GateV2Module, AgendamentosModule, PdfOperacionalV2Module, DispatchModule, DashboardModule],
})
export class GateDomainModule {}
