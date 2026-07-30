import { Injectable } from '@nestjs/common';
import { ObservabilidadeTelemetryStore } from '../../observabilidade/observabilidade-telemetry.store';
import { DatahubEtlStore } from '../datahub-etl.store';

/** Ponte entre pipelines Datahub e telemetria (HTTP/logs). */
@Injectable()
export class DatahubPipelineObsService {
  constructor(
    private readonly etl: DatahubEtlStore,
    private readonly telemetry: ObservabilidadeTelemetryStore,
  ) {}

  async logsEtl() {
    const logsAll = await this.telemetry.listLogs({ limit: 300 });
    const logsApp = logsAll.filter((l) => (l.rota ?? '').toLowerCase().includes('datahub'));
    const buckets = await this.telemetry.getBuckets();
    return {
      geradoEm: new Date().toISOString(),
      execucoesPipeline: await this.etl.ultimasExecucoes(150),
      logsAplicacaoFiltrados: logsApp.slice(0, 120),
      httpBucketsRelacionados: buckets
        .filter((b) => b.rotaNormalizada.includes('datahub'))
        .slice(0, 40),
    };
  }

  async metricasEtl() {
    const pipe = await this.etl.metricasAgregadas();
    const http = await this.telemetry.getContadoresGlobais();
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
