import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ObservabilidadeTelemetryStore } from './observabilidade-telemetry.store';
import { buildPrometheusText } from './observabilidade-prometheus.builder';
import { ObservabilidadeHealthService } from './observabilidade-health.service';

@Injectable()
export class ObservabilidadeService {
  constructor(
    private readonly store: ObservabilidadeTelemetryStore,
    private readonly health: ObservabilidadeHealthService,
    private readonly config: ConfigService,
  ) {}

  getDashboard() {
    const c = this.store.getContadoresGlobais();
    const disponibilidadePct =
      c.totalReq === 0 ? 100 : Math.round((c.sucesso2xx / c.totalReq) * 10000) / 100;

    const buckets = this.store.getBuckets();
    const porLatencia = [...buckets]
      .map((b) => ({
        rota: b.rotaNormalizada,
        latenciaMediaMs: b.contagem ? b.latenciaMsSum / b.contagem : 0,
        amostras: b.contagem,
      }))
      .sort((a, b) => b.latenciaMediaMs - a.latenciaMediaMs)
      .slice(0, 15);

    const logsRecent = this.store.listLogs({ limit: 500 });
    const custoPorOrigem: Record<string, { duracaoMsSum: number; n: number }> = {};
    for (const l of logsRecent) {
      const o = l.origem;
      if (!custoPorOrigem[o]) custoPorOrigem[o] = { duracaoMsSum: 0, n: 0 };
      custoPorOrigem[o].duracaoMsSum += l.duracaoMs ?? 0;
      custoPorOrigem[o].n += 1;
    }
    const modulosCustosos = Object.entries(custoPorOrigem)
      .map(([origem, v]) => ({
        origem,
        latenciaMediaMs: v.n ? v.duracaoMsSum / v.n : 0,
        amostras: v.n,
      }))
      .sort((a, b) => b.latenciaMediaMs - a.latenciaMediaMs);

    const opsPicos = logsRecent.filter((l) => l.origem === 'operacional').length;

    const incidentes = buckets.flatMap((b) =>
      Object.entries(b.status)
        .filter(([code]) => Number(code) >= 500)
        .map(([code, count]) => ({
          rota: b.rotaNormalizada,
          status: Number(code),
          count,
        })),
    );

    const errosPorDominio: Record<string, number> = {};
    for (const l of logsRecent) {
      if ((l.statusHttp ?? 200) >= 400) {
        errosPorDominio[l.origem] = (errosPorDominio[l.origem] ?? 0) + 1;
      }
    }

    const riscoTecnologico = {
      observacao:
        'Score proxy baseado em disponibilidade simulada e env OBS_RISCO_TEC_PROXY (0-100).',
      score:
        parseFloat(this.config.get<string>('OBS_RISCO_TEC_PROXY') ?? '') ||
        Math.max(0, 100 - (100 - disponibilidadePct)),
    };

    return {
      disponibilidadeApiPct: disponibilidadePct,
      totaisRequisicoes: c,
      rotasMaisLentas: porLatencia,
      modulosMaisCustosos: modulosCustosos,
      picosOperacaoGatePatioProxy: opsPicos,
      mapaIncidentes5xx: incidentes,
      rankingErrosPorDominio: Object.entries(errosPorDominio)
        .map(([dominio, erros]) => ({ dominio, erros }))
        .sort((a, b) => b.erros - a.erros),
      riscoTecnologico,
    };
  }

  async getPrometheusBody(): Promise<string> {
    const buckets = this.store.getBuckets();
    const mem = process.memoryUsage();
    const d = await this.health.detalhado();
    return buildPrometheusText({
      buckets,
      uptimeSec: Math.round(process.uptime()),
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      dbPingMs: d.banco.pingMs,
      redisPingMs: d.redis.pingMs,
      webhookQueueDepth: d.integracao.webhookQueueDepthProxy,
    });
  }
}
