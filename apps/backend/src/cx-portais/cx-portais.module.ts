import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlataformaCoreModule } from '../plataforma-integracao/plataforma-core.module';
import { PortalIdentityController } from './identity/portal-identity.controller';
import { PortalIdentityService } from './identity/portal-identity.service';
import { PortalJwtService } from './identity/portal-jwt.service';
import { PortalClienteController } from './portal-cliente.controller';
import { PortalFornecedorController } from './portal-fornecedor.controller';
import { PortalBrandingController } from './portal-branding.controller';
import { PortalComunicacaoController } from './portal-comunicacao.controller';
import { PortalAnalyticsController } from './portal-analytics.controller';
import { PortalFornecedorIdentitiesStore } from './stores/portal-fornecedor-identities.store';
import { PortalBrandingStore } from './stores/portal-branding.store';
import { PortalTicketsStore } from './stores/portal-tickets.store';
import { PortalAnalyticsStore } from './stores/portal-analytics.store';
import { PortalMarketplaceCxStore } from './stores/portal-marketplace-cx.store';
import { PortalClienteDataService } from './services/portal-cliente-data.service';
import { PortalFornecedorDataService } from './services/portal-fornecedor-data.service';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from './guards/cx-portal-auth.guard';
import { CxPortalSegmentGuard, CxPortalStaffOnlyGuard } from './guards/cx-portal-segment.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalRateLimitService } from './security/cx-portal-rate-limit.service';
import { CxPortalSecurityService } from './security/cx-portal-security.service';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';

/**
 * Fase 20 — Camada CX: portais cliente/fornecedor, IAM dedicado, branding, tickets e analytics.
 * Somente consumo/leitura + tickets; sem migrations; não altera serviços internos existentes.
 */
@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    PlataformaCoreModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('secrets.jwtSecret') ?? config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '1h') as StringValue,
        },
      }),
    }),
  ],
  controllers: [
    PortalIdentityController,
    PortalClienteController,
    PortalFornecedorController,
    PortalBrandingController,
    PortalComunicacaoController,
    PortalAnalyticsController,
  ],
  providers: [
    PortalJwtService,
    PortalIdentityService,
    PortalFornecedorIdentitiesStore,
    PortalBrandingStore,
    PortalTicketsStore,
    PortalAnalyticsStore,
    PortalMarketplaceCxStore,
    PortalClienteDataService,
    PortalFornecedorDataService,
    CxPortalPublicApiForbidGuard,
    CxPortalAuthGuard,
    CxPortalSegmentGuard,
    CxPortalStaffOnlyGuard,
    CxPortalRateLimitService,
    CxPortalRateLimitGuard,
    CxPortalSecurityService,
    PortalCxInterceptor,

    /* Re-export guards for DI */
  ],
})
export class CxPortaisModule {}
