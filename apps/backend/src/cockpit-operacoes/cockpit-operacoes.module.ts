import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PlataformaCoreModule } from '../plataforma-integracao/plataforma-core.module';
import { AutomacaoSharedModule } from '../automacao-processos/automacao-shared.module';
import { MobileHubModule } from '../mobile-hub/mobile-hub.module';
import { CockpitAccessGuard } from './guards/cockpit-access.guard';
import { CockpitMapService } from './services/cockpit-map.service';
import { CockpitTimelineService } from './services/cockpit-timeline.service';
import { CockpitAlertasService } from './services/cockpit-alertas.service';
import { CockpitIndicadoresService } from './services/cockpit-indicadores.service';
import { CockpitTenantService } from './services/cockpit-tenant.service';
import { CockpitAutomacaoService } from './services/cockpit-automacao.service';
import { CockpitTelemetriaService } from './services/cockpit-telemetria.service';
import { CockpitFinanceiroService } from './services/cockpit-financeiro.service';
import { CockpitRHService } from './services/cockpit-rh.service';
import { CockpitExecutivoService } from './services/cockpit-executivo.service';
import { CockpitMapaController } from './controllers/cockpit-mapa.controller';
import { CockpitTimelineController } from './controllers/cockpit-timeline.controller';
import { CockpitAlertasController } from './controllers/cockpit-alertas.controller';
import { CockpitIndicadoresController } from './controllers/cockpit-indicadores.controller';
import { CockpitTenantController } from './controllers/cockpit-tenant.controller';
import { CockpitAutomacaoController } from './controllers/cockpit-automacao.controller';
import { CockpitTelemetriaController } from './controllers/cockpit-telemetria.controller';
import { CockpitFinanceiroController } from './controllers/cockpit-financeiro.controller';
import { CockpitRHController } from './controllers/cockpit-rh.controller';
import { CockpitExecutivoController } from './controllers/cockpit-executivo.controller';

/**
 * Fase 22 — Cockpit NOC/TOC: agregação read-only (mapa, timeline, alertas, KPIs, multi-terminal, automação, telemetria, financeiro, RH, executivo).
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PlataformaCoreModule,
    AutomacaoSharedModule,
    MobileHubModule,
  ],
  controllers: [
    CockpitMapaController,
    CockpitTimelineController,
    CockpitAlertasController,
    CockpitIndicadoresController,
    CockpitTenantController,
    CockpitAutomacaoController,
    CockpitTelemetriaController,
    CockpitFinanceiroController,
    CockpitRHController,
    CockpitExecutivoController,
  ],
  providers: [
    CockpitAccessGuard,
    CockpitMapService,
    CockpitTimelineService,
    CockpitAlertasService,
    CockpitIndicadoresService,
    CockpitTenantService,
    CockpitAutomacaoService,
    CockpitTelemetriaService,
    CockpitFinanceiroService,
    CockpitRHService,
    CockpitExecutivoService,
  ],
})
export class CockpitOperacoesModule {}
