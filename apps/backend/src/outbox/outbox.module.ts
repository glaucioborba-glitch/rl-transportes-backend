import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ObservabilityCoreModule } from '../common/observability/observability-core.module';
import { FiscalIntegracaoModule } from '../fiscal-integracao/fiscal-integracao.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OutboxService } from './outbox.service';
import { OutboxWorker } from './outbox.worker';
import { NfseBoletoOutboxProcessor } from './nfse-boleto-outbox.processor';
import { NotificationModule } from '../notification/notification.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PortalNotificacoesModule } from '../portal-notificacoes/portal-notificacao.module';
import { UnidadeProcessoOutboxProcessor } from '../unidade-processo/unidade-processo-outbox.processor';

@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    ObservabilityCoreModule,
    AlertModule,
    RealtimeModule,
    FiscalIntegracaoModule,
    NotificationModule,
    TenantModule,
    AuditLogModule,
    PortalNotificacoesModule,
  ],
  providers: [
    OutboxService,
    NfseBoletoOutboxProcessor,
    UnidadeProcessoOutboxProcessor,
    OutboxWorker,
  ],
  exports: [OutboxService, NfseBoletoOutboxProcessor],
})
export class OutboxModule {}
