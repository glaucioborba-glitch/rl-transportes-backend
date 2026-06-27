import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditContextModule } from './audit-context.module';
import { AuditTrailController } from './audit-trail.controller';
import { AuditTrailInterceptor } from './audit-trail.interceptor';
import { AuditTrailService } from './audit-trail.service';

@Module({
  imports: [AuditContextModule, PrismaModule],
  controllers: [AuditTrailController],
  providers: [
    AuditTrailService,
    { provide: APP_INTERCEPTOR, useClass: AuditTrailInterceptor },
  ],
  exports: [AuditTrailService],
})
export class AuditTrailModule {}
