import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import secretsConfig from './config/secrets.config';
import nfseConfig from './config/nfse.config';
import securityConfig from './config/security.config';
import { winstonModuleOptions } from './common/logger/winston.config';
import { ObservabilityCoreModule } from './common/observability/observability-core.module';
import { TraceMiddleware } from './common/observability/trace.middleware';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { FaturamentoModule } from './faturamento/faturamento.module';
import { PortalModule } from './portal/portal.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { SolicitacoesModule } from './solicitacoes/solicitacoes.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DashboardFinanceiroModule } from './dashboard-financeiro/dashboard-financeiro.module';
import { DashboardPerformanceModule } from './dashboard-performance/dashboard-performance.module';
import { ComercialPricingModule } from './comercial-pricing/comercial-pricing.module';
import { IaOperacionalModule } from './ia-operacional/ia-operacional.module';
import { SimuladorTerminalModule } from './simulador-terminal/simulador-terminal.module';
import { PlanejamentoEstrategicoModule } from './planejamento-estrategico/planejamento-estrategico.module';
import { PlanejamentoPessoalModule } from './planejamento-pessoal/planejamento-pessoal.module';
import { FiscalGovernancaModule } from './fiscal-governanca/fiscal-governanca.module';
import { FinanceiroConciliacaoModule } from './financeiro-conciliacao/financeiro-conciliacao.module';
import { TesourariaModule } from './tesouraria/tesouraria.module';
import { FolhaRhModule } from './folha-rh/folha-rh.module';
import { RhPerformanceModule } from './rh-performance/rh-performance.module';
import { GrcComplianceModule } from './grc-compliance/grc-compliance.module';
import { IntegracaoMobilidadeModule } from './integracao-mobilidade/integracao-mobilidade.module';
import { ObservabilidadeModule } from './observabilidade/observabilidade.module';
import { ObservabilityModule } from './observability/observability.module';
import { ResilienceModule } from './resilience/resilience.module';
import { IaPreditivaModule } from './ia-preditiva/ia-preditiva.module';
import { DatahubModule } from './datahub/datahub.module';
import { PlataformaIntegracaoModule } from './plataforma-integracao/plataforma-integracao.module';
import { AutomacaoProcessosModule } from './automacao-processos/automacao-processos.module';
import { PasswordPolicyModule } from './common/security/password-policy.module';
import { AddressModule } from './common/address/address.module';
import { CxPortaisModule } from './cx-portais/cx-portais.module';
import { PortalAuditInterceptor } from './cx-portais/audit/portal-audit.interceptor';
import { MobileHubModule } from './mobile-hub/mobile-hub.module';
import { CockpitOperacoesModule } from './cockpit-operacoes/cockpit-operacoes.module';
import { SessionModule } from './auth/session/session.module';
import { DeviceAuditInterceptor } from './auditoria/device-audit.interceptor';
import { SecurityCenterModule } from './security-center/security-center.module';
import { SecurityEngineModule } from './security-engine/security-engine.module';
import { ChaosGateModule } from './chaos/chaos-gate.module';
import { ChaosModule } from './chaos/chaos.module';
import { AgendamentosModule } from './agendamentos/agendamentos.module';
import { SolicitacoesV2Module } from './modules/solicitacoes-v2/solicitacoes-v2.module';
import { PdfOperacionalV2Module } from './pdf-operacional-v2/pdf-operacional-v2.module';
import { GateV2Module } from './gate-v2/gate.module';
import { TosModule } from './tos/tos.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { RealtimeModule } from './realtime/realtime.module';
import { PessoasAutorizadasModule } from './pessoas-autorizadas/pessoas-autorizadas.module';
import { PessoasPermissoesModule } from './pessoas-permissoes/pessoas-permissoes.module';
import { ContainerTimelineModule } from './container-timeline/container-timeline.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      load: [secretsConfig, nfseConfig, securityConfig],
    }),
    ObservabilityCoreModule,
    WinstonModule.forRoot(winstonModuleOptions),
    CacheModule.register({
      isGlobal: true,
      ttl: 300_000,
    }),
    PasswordPolicyModule,
    AddressModule,
    ChaosGateModule,
    PrismaModule,
    RedisModule,
    RealtimeModule,
    ResilienceModule,
    AuditoriaModule,
    AuthModule,
    ClientesModule,
    SolicitacoesModule,
    SolicitacoesV2Module,
    PdfOperacionalV2Module,
    GateV2Module,
    TosModule,
    DispatchModule,
    PessoasAutorizadasModule,
    PessoasPermissoesModule,
    ContainerTimelineModule,
    AgendamentosModule,
    FaturamentoModule,
    PortalModule,
    RelatoriosModule,
    DashboardModule,
    DashboardFinanceiroModule,
    DashboardPerformanceModule,
    ComercialPricingModule,
    IaOperacionalModule,
    SimuladorTerminalModule,
    PlanejamentoEstrategicoModule,
    PlanejamentoPessoalModule,
    FiscalGovernancaModule,
    FinanceiroConciliacaoModule,
    TesourariaModule,
    FolhaRhModule,
    RhPerformanceModule,
    GrcComplianceModule,
    IntegracaoMobilidadeModule,
    ObservabilidadeModule,
    ObservabilityModule,
    IaPreditivaModule,
    DatahubModule,
    PlataformaIntegracaoModule,
    AutomacaoProcessosModule,
    CxPortaisModule,
    MobileHubModule,
    CockpitOperacoesModule,
    SessionModule,
    SecurityCenterModule,
    SecurityEngineModule,
    ChaosModule,
  ],
  controllers: [HealthController],
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
