import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditContextModule } from '../audit-trail/audit-context.module';
import { AuditContextService } from '../audit-trail/audit-context.service';
import { createAuditTrailExtension } from '../audit-trail/audit-trail.prisma-extension';
import { ChaosGateModule } from '../chaos/chaos-gate.module';
import { TenantContextModule } from '../tenant/tenant-context.module';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  imports: [ConfigModule, ChaosGateModule, TenantContextModule, AuditContextModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
