import { Module, forwardRef } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { BillingEngineModule } from '../billing-engine/billing-engine.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { ArmazenagemBillingService } from './armazenagem-billing.service';
import { FaturamentoMoraService } from './faturamento-mora.service';

@Module({
  imports: [
    PrismaModule,
    BillingEngineModule,
    forwardRef(() => OutboxModule),
    AuditoriaModule,
    TenantModule,
  ],
  providers: [ArmazenagemBillingService, FaturamentoMoraService],
  exports: [ArmazenagemBillingService, FaturamentoMoraService],
})
export class ArmazenagemFaturamentoModule {}
