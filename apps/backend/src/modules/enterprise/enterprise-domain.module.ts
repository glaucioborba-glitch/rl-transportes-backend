import { Module } from '@nestjs/common';
import { AutomacaoProcessosModule } from '../../automacao-processos/automacao-processos.module';
import { ChaosModule } from '../../chaos/chaos.module';
import { FolhaRhModule } from '../../folha-rh/folha-rh.module';
import { WorkforceRhModule } from '../../workforce-rh/workforce-rh.module';
import { FiscalGovernancaModule } from '../../fiscal-governanca/fiscal-governanca.module';
import { GrcComplianceModule } from '../../grc-compliance/grc-compliance.module';
import { IntegracaoMobilidadeModule } from '../../integracao-mobilidade/integracao-mobilidade.module';
import { MobileHubModule } from '../../mobile-hub/mobile-hub.module';
import { ObservabilidadeModule } from '../../observabilidade/observabilidade.module';
import { ObservabilityModule } from '../../observability/observability.module';
import { PlanejamentoEstrategicoModule } from '../../planejamento-estrategico/planejamento-estrategico.module';
import { PlanejamentoPessoalModule } from '../../planejamento-pessoal/planejamento-pessoal.module';
import { RhPerformanceModule } from '../../rh-performance/rh-performance.module';
import { SimuladorTerminalModule } from '../../simulador-terminal/simulador-terminal.module';

/** Módulos corporativos / fases demo — omitidos em FEATURE_PHASES=operational. */
@Module({
  imports: [
    SimuladorTerminalModule,
    PlanejamentoEstrategicoModule,
    PlanejamentoPessoalModule,
    FiscalGovernancaModule,
    FolhaRhModule,
    WorkforceRhModule,
    RhPerformanceModule,
    GrcComplianceModule,
    IntegracaoMobilidadeModule,
    ObservabilidadeModule,
    ObservabilityModule,
    AutomacaoProcessosModule,
    MobileHubModule,
    ChaosModule,
  ],
})
export class EnterpriseDomainModule {}
