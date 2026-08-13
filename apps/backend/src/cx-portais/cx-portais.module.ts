import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { PortalIdentityController } from './identity/portal-identity.controller';
import { PortalIdentityService } from './identity/portal-identity.service';
import { PortalJwtService } from './identity/portal-jwt.service';
import { DashboardPortalController } from './dashboard-portal.controller';
import { PortalClienteController } from './portal-cliente.controller';
import { PortalSolicitacoesV2Controller } from './portal-solicitacoes-v2.controller';
import { PortalFornecedorController } from './portal-fornecedor.controller';
import { PortalBrandingController } from './portal-branding.controller';
import { PortalComunicacaoController } from './portal-comunicacao.controller';
import { PortalAnalyticsController } from './portal-analytics.controller';
import { SecurityPortalController } from './security-portal.controller';
import { PortalFornecedorIdentitiesStore } from './stores/portal-fornecedor-identities.store';
import { PortalBrandingStore } from './stores/portal-branding.store';
import { PortalTicketsStore } from './stores/portal-tickets.store';
import { PortalAnalyticsStore } from './stores/portal-analytics.store';
import { PortalMarketplaceCxStore } from './stores/portal-marketplace-cx.store';
import { PortalClienteDataService } from './services/portal-cliente-data.service';
import { PlataformaCoreModule } from '../plataforma-integracao/plataforma-core.module';
import { DashboardPortalService } from './dashboard/dashboard-portal.service';
import { PortalAuditService } from './audit/portal-audit.service';
import { PortalFornecedorDataService } from './services/portal-fornecedor-data.service';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from './guards/cx-portal-auth.guard';
import { CxPortalSegmentGuard, CxPortalStaffOnlyGuard } from './guards/cx-portal-segment.guard';
import { JwtPortalAuthGuard } from './guards/jwt-portal.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalRateLimitService } from './security/cx-portal-rate-limit.service';
import { CxPortalSecurityService } from './security/cx-portal-security.service';
import { PortalCadastroAprovadoGuard } from './guards/portal-cadastro-aprovado.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import { EmailModule } from '../common/email/email.module';
import { SolicitacoesModule } from '../solicitacoes/solicitacoes.module';
import { AddressModule } from '../common/address/address.module';
import { SessionModule } from '../auth/session/session.module';
import { SecurityCenterModule } from '../security-center/security-center.module';
import { SolicitacoesV2Module } from '../modules/solicitacoes-v2/solicitacoes-v2.module';
import { PessoasAutorizadasModule } from '../pessoas-autorizadas/pessoas-autorizadas.module';
import { PessoasPermissoesModule } from '../pessoas-permissoes/pessoas-permissoes.module';
import { AgendamentosModule } from '../agendamentos/agendamentos.module';
import { YardReadModule } from '../yard-read/yard-read.module';
import { ContainerTimelineModule } from '../container-timeline/container-timeline.module';
import { ArmazenagemFaturamentoModule } from '../armazenagem-faturamento/armazenagem-faturamento.module';
import { ContainerTimelineClientController } from '../container-timeline/container-timeline-client.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { VistoriaModule } from '../vistoria/vistoria.module';
import { VistoriaPortalController } from '../vistoria/vistoria-portal.controller';
import { HoldReleaseModule } from '../hold-release/hold-release.module';
import { TermosUsoModule } from '../common/legal/termos-uso.module';
import { DominioCorporativoModule } from '../common/validation/dominio-corporativo.module';
import { TransportadorasAutorizadasModule } from '../transportadoras-autorizadas/transportadoras-autorizadas.module';
import { TenantModule } from '../tenant/tenant.module';
import { CadastrosModule } from '../cadastros/cadastros.module';
import { PatioV2Module } from '../patio-v2/patio.module';

/**
 * Fase 20 — Camada CX: portais cliente/fornecedor, IAM dedicado, branding, tickets e analytics.
 * Somente consumo/leitura + tickets; sem migrations; não altera serviços internos existentes.
 */
@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    CadastrosModule,
    PatioV2Module,
    SolicitacoesModule,
    EmailModule,
    AddressModule,
    SessionModule,
    RedisModule,
    SecurityCenterModule,
    SolicitacoesV2Module,
    PessoasAutorizadasModule,
    PessoasPermissoesModule,
    AgendamentosModule,
    YardReadModule,
    ContainerTimelineModule,
    ArmazenagemFaturamentoModule,
    AuditLogModule,
    VistoriaModule,
    HoldReleaseModule,
    TermosUsoModule,
    DominioCorporativoModule,
    TransportadorasAutorizadasModule,
    TenantModule,
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
    DashboardPortalController,
    PortalClienteController,
    PortalSolicitacoesV2Controller,
    PortalFornecedorController,
    PortalBrandingController,
    PortalComunicacaoController,
    PortalAnalyticsController,
    SecurityPortalController,
    ContainerTimelineClientController,
    VistoriaPortalController,
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
    DashboardPortalService,
    PortalAuditService,
    PortalFornecedorDataService,
    CxPortalPublicApiForbidGuard,
    CxPortalAuthGuard,
    JwtPortalAuthGuard,
    CxPortalSegmentGuard,
    CxPortalStaffOnlyGuard,
    CxPortalRateLimitService,
    CxPortalRateLimitGuard,
    CxPortalSecurityService,
    PortalCxInterceptor,
    PortalCadastroAprovadoGuard,

    /* Re-export guards for DI */
  ],
  exports: [PortalIdentityService, PortalAuditService, PortalJwtService, CxPortalAuthGuard],
})
export class CxPortaisModule {}
