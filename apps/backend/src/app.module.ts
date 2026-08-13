import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TraceMiddleware } from './common/observability/trace.middleware';
import bankingConfig from './config/banking.config';
import featurePhasesConfig from './config/feature-phases.config';
import nfseConfig from './config/nfse.config';
import secretsConfig from './config/secrets.config';
import securityConfig from './config/security.config';
import whatsappConfig from './config/whatsapp.config';
import { PortalAuditInterceptor } from './cx-portais/audit/portal-audit.interceptor';
import { DeviceAuditInterceptor } from './auditoria/device-audit.interceptor';
import { HealthModule } from './health/health.module';
import { BillingDomainModule } from './modules/billing/billing-domain.module';
import { GateDomainModule } from './modules/gate/gate-domain.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PortalClientDomainModule } from './modules/portal-client/portal-client-domain.module';
import { resolvePhaseImports } from './modules/phase-imports';
import { YardDomainModule } from './modules/yard/yard-domain.module';

/**
 * H4 — Monolito modular: bounded contexts + FEATURE_PHASES + feature flags globais.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      load: [secretsConfig, nfseConfig, bankingConfig, securityConfig, featurePhasesConfig, whatsappConfig],
    }),
    PlatformModule,
    GateDomainModule,
    YardDomainModule,
    BillingDomainModule,
    PortalClientDomainModule,
    HealthModule,
    ...resolvePhaseImports(),
  ],
  controllers: [],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: PortalAuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: DeviceAuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
