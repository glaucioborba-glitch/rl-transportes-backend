import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ObservabilityCoreModule } from '../common/observability/observability-core.module';
import { FiscalIntegracaoModule } from '../fiscal-integracao/fiscal-integracao.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { BillingOutboxProcessor } from './billing-outbox.processor';
import { OutboxService } from './outbox.service';
import { OutboxWorker } from './outbox.worker';
import { NfseBoletoOutboxProcessor } from './nfse-boleto-outbox.processor';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    ObservabilityCoreModule,
    AlertModule,
    RealtimeModule,
    FiscalIntegracaoModule,
    NotificationModule,
  ],
  providers: [OutboxService, BillingOutboxProcessor, NfseBoletoOutboxProcessor, OutboxWorker],
  exports: [OutboxService, BillingOutboxProcessor, NfseBoletoOutboxProcessor],
})
export class OutboxModule {}
