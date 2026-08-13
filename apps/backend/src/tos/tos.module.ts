import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../auth/session/session.module';
import { CxPortaisModule } from '../cx-portais/cx-portais.module';
import { OutboxModule } from '../outbox/outbox.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../prisma/prisma.module';
import { YardReadModule } from '../yard-read/yard-read.module';
import { TosEventsModule } from './tos-events.module';
import { BillingListener } from './billing.listener';
import { ContainerLifecycleService } from './container-lifecycle.service';
import { RepairApprovalAuthGuard } from './guards/repair-approval-auth.guard';
import { TosController } from './tos.controller';

@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    AuthModule,
    SessionModule,
    CxPortaisModule,
    TosEventsModule,
    OutboxModule,
    NotificationModule,
    YardReadModule,
    JwtModule.register({}),
  ],
  controllers: [TosController],
  providers: [
    ContainerLifecycleService,
    BillingListener,
    RepairApprovalAuthGuard,
  ],
  exports: [ContainerLifecycleService, TosEventsModule],
})
export class TosModule {}
