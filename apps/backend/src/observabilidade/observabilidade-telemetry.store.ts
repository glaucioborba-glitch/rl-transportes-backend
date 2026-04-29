import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  AlertaRegistro,
  AlertaTipo,
  HttpMetricBucket,
  LogEstruturado,
  LogOrigem,
  LogSeveridade,
  TraceCompleto,
  TraceSpanRecord,
} from './observabilidade.types';
import { classificarOrigemPorRota, maskEmail, normalizarRotaMetricas } from './observabilidade-anonymize.util';

const MAX_LOGS = 4000;
const MAX_TRACES = 800;
const MAX_ALERTAS = 600;

/** Armazenamento em memória da telemetria (sem migração — Fase 15). */
@Injectable()
export class ObservabilidadeTelemetryStore {
  private logs: LogEstruturado[] = [];
  private buckets = new Map<string, HttpMetricBucket>();
  private traces = new Map<string, TraceCompleto>();
  private traceOrder: string[] = [];
  private alertas: AlertaRegistro[] = [];

  private totalReq = 0;
  private sucesso2xx = 0;
  private erro4xx = 0;
  private erro5xx = 0;

  registrarHttpRoundtrip(input: {
    requestId: string;
    path: string;
    method: string;
    statusCode: number;
    durationMs: number;
    usuarioId?: string;
    usuarioEmail?: string;
    clienteId?: string | null;
  }): void {
    const rota = normalizarRotaMetricas(input.path);
    const origem = classificarOrigemPorRota(input.path);
    const sev = severityFromStatus(input.statusCode);

    const log: LogEstruturado = {
      timestamp: new Date().toISOString(),
      origem,
      severidade: sev,
      mensagem: `${input.method} ${rota} → ${input.statusCode} (${input.durationMs}ms)`,
      requestId: input.requestId,
      usuarioId: input.usuarioId,
      usuarioEmail: maskEmail(input.usuarioEmail),
      clienteId: input.clienteId ?? undefined,
      metodo: input.method,
      rota,
      statusHttp: input.statusCode,
      duracaoMs: input.durationMs,
      contexto: { origem },
    };
    this.pushLog(log);

    let b = this.buckets.get(rota);
    if (!b) {
      b = { rotaNormalizada: rota, latenciaMsSum: 0, contagem: 0, status: {} };
      this.buckets.set(rota, b);
    }
    b.latenciaMsSum += input.durationMs;
    b.contagem += 1;
    b.status[input.statusCode] = (b.status[input.statusCode] ?? 0) + 1;

    this.totalReq += 1;
    if (input.statusCode >= 500) this.erro5xx += 1;
    else if (input.statusCode >= 400) this.erro4xx += 1;
    else this.sucesso2xx += 1;

    const trace = this.buildSyntheticTrace(input.requestId, rota, origem, input.durationMs);
    this.traces.set(input.requestId, trace);
    this.traceOrder.push(input.requestId);
    if (this.traceOrder.length > MAX_TRACES) {
      const drop = this.traceOrder.shift();
      if (drop) this.traces.delete(drop);
    }
  }

  private pushLog(log: LogEstruturado) {
    this.logs.push(log);
    if (this.logs.length > MAX_LOGS) this.logs = this.logs.slice(-MAX_LOGS);
  }

  listLogs(filter?: {
    origem?: LogOrigem;
    severidade?: LogSeveridade;
    limit?: number;
  }): LogEstruturado[] {
    let rows = [...this.logs].reverse();
    if (filter?.origem) rows = rows.filter((l) => l.origem === filter.origem);
    if (filter?.severidade) rows = rows.filter((l) => l.severidade === filter.severidade);
    const lim = Math.min(filter?.limit ?? 200, 500);
    return rows.slice(0, lim);
  }

  getBuckets(): HttpMetricBucket[] {
    return [...this.buckets.values()];
  }

  getContadoresGlobais() {
    return {
      totalReq: this.totalReq,
      sucesso2xx: this.sucesso2xx,
      erro4xx: this.erro4xx,
      erro5xx: this.erro5xx,
    };
  }

  getTrace(requestId: string): TraceCompleto | undefined {
    return this.traces.get(requestId);
  }

  listTraces(limit = 50): TraceCompleto[] {
    const ids = [...this.traceOrder].reverse().slice(0, limit);
    return ids.map((id) => this.traces.get(id)).filter(Boolean) as TraceCompleto[];
  }

  registrarAlerta(input: {
    tipo: AlertaTipo;
    severidade: LogSeveridade;
    mensagem: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }): AlertaRegistro {
    const a: AlertaRegistro = {
      id: randomUUID(),
      tipo: input.tipo,
      severidade: input.severidade,
      mensagem: input.mensagem,
      criadoEm: new Date().toISOString(),
      requestId: input.requestId,
      metadata: input.metadata,
    };
    this.alertas.push(a);
    if (this.alertas.length > MAX_ALERTAS) this.alertas = this.alertas.slice(-MAX_ALERTAS);
    return a;
  }

  listAlertas(limit = 100): AlertaRegistro[] {
    return [...this.alertas].reverse().slice(0, limit);
  }

  private buildSyntheticTrace(
    requestId: string,
    rota: string,
    origem: LogOrigem,
    totalMs: number,
  ): TraceCompleto {
    const traceId = requestId;
    const t = Math.max(1, totalMs);
    const httpId = `${traceId}-http`;
    const svcId = `${traceId}-svc`;
    const dbId = `${traceId}-db`;
    const intId = `${traceId}-int`;

    const spans: TraceSpanRecord[] = [
      {
        id: httpId,
        traceId,
        parentId: null,
        nome: 'http.server',
        layer: 'http',
        inicioMs: 0,
        duracaoMs: t,
      },
      {
        id: svcId,
        traceId,
        parentId: httpId,
        nome: `servico.${origem}`,
        layer: 'servico',
        inicioMs: Math.round(t * 0.05),
        duracaoMs: Math.round(t * 0.55),
      },
      {
        id: dbId,
        traceId,
        parentId: svcId,
        nome: 'prisma.query',
        layer: 'banco',
        inicioMs: Math.round(t * 0.15),
        duracaoMs: Math.round(t * 0.25),
      },
      {
        id: intId,
        traceId,
        parentId: httpId,
        nome: 'integracao opcional',
        layer: origem === 'integracao' ? 'integracao' : 'webhooks',
        inicioMs: Math.round(t * 0.4),
        duracaoMs: Math.round(t * 0.2),
      },
    ];

    return {
      traceId,
      requestId,
      rootSpanId: httpId,
      spans,
      fluxoResumo: deduzirFluxo(rota),
    };
  }
}

function severityFromStatus(code: number): LogSeveridade {
  if (code >= 500) return 'ERROR';
  if (code >= 400) return 'WARN';
  return 'INFO';
}

function deduzirFluxo(rota: string): string {
  const r = rota.toLowerCase();
  if (
    r.includes('portaria') ||
    r.includes('gate') ||
    r.includes('patio') ||
    r.includes('saida') ||
    r.includes('solicitacao')
  )
    return 'portaria → gate → patio → saida → (faturamento)';
  if (r.includes('faturamento') || r.includes('nfse') || r.includes('boleto'))
    return 'operacao → faturamento → nfse → boleto';
  return 'fluxo generico API';
}
