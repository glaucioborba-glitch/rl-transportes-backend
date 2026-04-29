import { Injectable } from '@nestjs/common';
import { ObservabilidadeTelemetryStore } from '../../observabilidade/observabilidade-telemetry.store';
import { DatahubEtlStore } from '../datahub-etl.store';

/** Ponte entre pipelines Datahub e telemetria da Fase 15 (HTTP/logs sintéticos). */
@Injectable()
export class DatahubPipelineObsService {
  constructor(
    private readonly etl: DatahubEtlStore,
    private readonly telemetry: ObservabilidadeTelemetryStore,
  ) {}

  logsEtl() {
    const logsApp = this.telemetry
      .listLogs({ limit: 300 })
      .filter((l) => (l.rota ?? '').toLowerCase().includes('datahub'));
    return {
      geradoEm: new Date().toISOString(),
      execucoesPipeline: this.etl.ultimasExecucoes(150),
      logsAplicacaoFiltrados: logsApp.slice(0, 120),
      httpBucketsRelacionados: this.telemetry
        .getBuckets()
        .filter((b) => b.rotaNormalizada.includes('datahub'))
        .slice(0, 40),
    };
  }

  metricasEtl() {
    const pipe = this.etl.metricasAgregadas();
    const http = this.telemetry.getContadoresGlobais();
    return {
      geradoEm: new Date().toISOString(),
      pipeline: pipe,
      httpGlobal: http,
      falhasPipeline: pipe.falhas,
      anomaliaProxyPct:
        http.totalReq > 0 ? Math.round((http.erro5xx / http.totalReq) * 10000) / 100 : 0,
    };
  }
}
