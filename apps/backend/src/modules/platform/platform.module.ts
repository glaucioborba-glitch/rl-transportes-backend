import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import { AuditTrailModule } from '../../audit-trail/audit-trail.module';
import { AuditoriaModule } from '../../auditoria/auditoria.module';
import { AuthModule } from '../../auth/auth.module';
import { SessionModule } from '../../auth/session/session.module';
import { ClientesModule } from '../../clientes/clientes.module';
import { AddressModule } from '../../common/address/address.module';
import { ConfigCacheModule } from '../../common/cache/config-cache.module';
import { winstonModuleOptions } from '../../common/logger/winston.config';
import { ObservabilityCoreModule } from '../../common/observability/observability-core.module';
import { PasswordPolicyModule } from '../../common/security/password-policy.module';
import { FeatureFlagsModule } from '../../feature-flags/feature-flags.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RealtimeModule } from '../../realtime/realtime.module';
import { RedisModule } from '../../redis/redis.module';
import { ResilienceModule } from '../../resilience/resilience.module';
import { SecurityCenterModule } from '../../security-center/security-center.module';
import { SecurityEngineModule } from '../../security-engine/security-engine.module';
import { TenantModule } from '../../tenant/tenant.module';
import { SuperAdminModule } from '../../super-admin/super-admin.module';
import { BillingEngineModule } from '../../billing-engine/billing-engine.module';
import { SolicitacoesModule } from '../../solicitacoes/solicitacoes.module';
import { SolicitacoesV2Module } from '../solicitacoes-v2/solicitacoes-v2.module';

/** Infra compartilhada — Prisma, Redis, Auth, observabilidade, feature flags. */
@Module({
  imports: [
    ObservabilityCoreModule,
    WinstonModule.forRoot(winstonModuleOptions),
    CacheModule.register({ isGlobal: true, ttl: 300_000 }),
    ScheduleModule.forRoot(),
    PasswordPolicyModule,
    ConfigCacheModule,
    FeatureFlagsModule,
    AddressModule,
    PrismaModule,
    RedisModule,
    RealtimeModule,
    ResilienceModule,
    AuditoriaModule,
    AuditTrailModule,
    AuthModule,
    SessionModule,
    ClientesModule,
    SolicitacoesModule,
    SolicitacoesV2Module,
    SecurityCenterModule,
    SecurityEngineModule,
    TenantModule,
    SuperAdminModule,
    BillingEngineModule,
  ],
  exports: [
    ObservabilityCoreModule,
    ConfigCacheModule,
    FeatureFlagsModule,
    PrismaModule,
    RedisModule,
    RealtimeModule,
    ResilienceModule,
    AuditoriaModule,
    AuthModule,
    SessionModule,
    ClientesModule,
    SolicitacoesModule,
    SolicitacoesV2Module,
    SecurityCenterModule,
    SecurityEngineModule,
    TenantModule,
  ],
})
export class PlatformModule {}
