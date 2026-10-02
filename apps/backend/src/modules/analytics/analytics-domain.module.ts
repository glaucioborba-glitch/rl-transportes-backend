import { Module } from '@nestjs/common';
import { BiAnalyticsModule } from '../../bi-analytics/bi-analytics.module';
import { CockpitOperacoesModule } from '../../cockpit-operacoes/cockpit-operacoes.module';
import { ComercialPricingModule } from '../../comercial-pricing/comercial-pricing.module';
import { DashboardFinanceiroModule } from '../../dashboard-financeiro/dashboard-financeiro.module';
import { DashboardPerformanceModule } from '../../dashboard-performance/dashboard-performance.module';
import { DatahubModule } from '../../datahub/datahub.module';
import { IaOperacionalModule } from '../../ia-operacional/ia-operacional.module';
import { IaPreditivaModule } from '../../ia-preditiva/ia-preditiva.module';
import { RelatoriosModule } from '../../relatorios/relatorios.module';

/**
 * Bounded Context — Analytics / BI (carregamento opcional ou lazy).
 * Future-proof: recorte para microserviço de relatórios.
 */
@Module({
  imports: [
    BiAnalyticsModule,
    DatahubModule,
    RelatoriosModule,
    DashboardFinanceiroModule,
    DashboardPerformanceModule,
    CockpitOperacoesModule,
    ComercialPricingModule,
    IaOperacionalModule,
    IaPreditivaModule,
  ],
})
export class AnalyticsDomainModule {}
