import { CacheModule } from '@nestjs/cache-manager';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import secretsConfig from './config/secrets.config';
import nfseConfig from './config/nfse.config';
import { winstonModuleOptions } from './common/logger/winston.config';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      load: [secretsConfig, nfseConfig],
    }),
    WinstonModule.forRoot(winstonModuleOptions),
    CacheModule.register({
      isGlobal: true,
      ttl: 300_000,
    }),
    PrismaModule,
    RedisModule,
    AuditoriaModule,
    AuthModule,
    ClientesModule,
    SolicitacoesModule,
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
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}
