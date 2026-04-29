import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CockpitIndicadoresService } from './cockpit-indicadores.service';
import { CockpitAlertasService } from './cockpit-alertas.service';
import { CockpitFinanceiroService } from './cockpit-financeiro.service';
import { CockpitTelemetriaService } from './cockpit-telemetria.service';
import { CockpitRHService } from './cockpit-rh.service';

@Injectable()
export class CockpitExecutivoService {
  constructor(
    private readonly ind: CockpitIndicadoresService,
    private readonly alertas: CockpitAlertasService,
    private readonly fin: CockpitFinanceiroService,
    private readonly tel: CockpitTelemetriaService,
    private readonly rh: CockpitRHService,
    private readonly config: ConfigService,
  ) {}

  async painel() {
    const [indicadores, alertas, riscoFin, telM, rhEff] = await Promise.all([
      this.ind.resumo(),
      this.alertas.todos(),
      this.fin.riscos(),
      Promise.resolve(this.tel.mobile()),
      this.rh.eficiencia(),
    ]);

    const criticos = alertas.itens.filter((x) => x.severidade === 'critica' || x.severidade === 'alta').length;
    const tech = telM.agregado24h;

    const trends = {
      dias7: parseFloat(this.config.get<string>('COCKPIT_TREND_IA_7D_PROXY') ?? '0'),
      dias30: parseFloat(this.config.get<string>('COCKPIT_TREND_IA_30D_PROXY') ?? '0'),
      dias90: parseFloat(this.config.get<string>('COCKPIT_TREND_IA_90D_PROXY') ?? '0'),
    };

    return {
      geradoEm: new Date().toISOString(),
      slaGeralPct: indicadores.slaPorCliente.length
        ? Math.round(
            indicadores.slaPorCliente.reduce((a, x) => a + x.slaRealizadoPct, 0) /
              indicadores.slaPorCliente.length,
          )
        : null,
      riscoOperacional: indicadores.riscoOperacionalScoreProxy,
      riscoFinanceiro: riscoFin.riscoInadimplenciaPorCliente.length,
      riscoFiscal: riscoFin.notasPendentes.length,
      riscoRH: rhEff.gargalosMaoDeObraProxy.length + (rhEff.turno.ausenciasProxy > 0 ? 1 : 0),
      riscoTecnologicoProxy: tech.usoOfflinePct != null ? tech.usoOfflinePct : null,
      capacidadeInstaladaVsUsada: {
        capacidade: indicadores.patio.capacidadeInstalada,
        ocupacaoPct: indicadores.patio.ocupacaoPct,
        unidades: indicadores.patio.unidadesNoPatio,
      },
      tendenciasIaProxy7_30_90d: trends,
      alertasCriticosAbertos: criticos,
      throughput: indicadores.throughput,
    };
  }
}
