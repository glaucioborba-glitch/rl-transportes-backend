import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import whatsappConfig from '../config/whatsapp.config';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationEnqueueService } from './notification-enqueue.service';
import { NotificationRecipientService } from './notification-recipient.service';
import { WhatsappOutboxProcessor } from './whatsapp-outbox.processor';
import { WhatsappService } from './whatsapp.service';

@Module({
  imports: [PrismaModule, AuditLogModule, ConfigModule.forFeature(whatsappConfig)],
  providers: [
    WhatsappService,
    NotificationRecipientService,
    NotificationEnqueueService,
    WhatsappOutboxProcessor,
  ],
  exports: [
    WhatsappService,
    NotificationRecipientService,
    NotificationEnqueueService,
    WhatsappOutboxProcessor,
  ],
})
export class NotificationModule {}
