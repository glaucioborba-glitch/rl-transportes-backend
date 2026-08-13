import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';
import {
  MAX_TELEMETRY_LOGS,
  MAX_TELEMETRY_TRACES,
  OBS_TELEMETRY_BUCKETS,
  OBS_TELEMETRY_COUNTERS,
  OBS_TELEMETRY_LOGS,
  OBS_TELEMETRY_TRACE_ORDER,
  OBS_TELEMETRY_TRACES,
  TTL_TELEMETRY_LOGS_SEC,
  TTL_TELEMETRY_METRICS_SEC,
  TTL_TELEMETRY_TRACES_SEC,
} from './observabilidade.constants';
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

const MAX_ALERTAS = 600;

/** Telemetria HTTP — Redis em produção; fallback in-memory em dev sem Redis. */
@Injectable()
export class ObservabilidadeTelemetryStore {
  private readonly logger = new Logger(ObservabilidadeTelemetryStore.name);
  private readonly isProd: boolean;

  private logs: LogEstruturado[] = [];
  private buckets = new Map<string, HttpMetricBucket>();
  private traces = new Map<string, TraceCompleto>();
  private traceOrder: string[] = [];
  private alertas: AlertaRegistro[] = [];

  private totalReq = 0;
  private sucesso2xx = 0;
  private erro4xx = 0;
  private erro5xx = 0;

  constructor(
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly config?: ConfigService,
  ) {
    this.isProd = (this.config?.get<string>('NODE_ENV') ?? 'development') === 'production';
  }

  /** Produção ou Redis real disponível — telemetria principal via Redis. */
  isRedisBackendActive(): boolean {
    if (this.isProd) return true;
    return this.redis != null && !this.redis.isMemoryFallback();
  }

  /** Dev local: persiste também no buffer in-memory além do Redis. */
  private shouldMirrorInMemory(): boolean {
    return !this.isProd;
  }

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

    const trace = this.buildSyntheticTrace(input.requestId, rota, origem, input.durationMs);

    if (this.isRedisBackendActive() && this.redis) {
      void this.persistRoundtripRedis(log, trace, rota, input.statusCode, input.durationMs).catch(
        (e) => this.logger.warn(`telemetry redis: ${(e as Error).message}`),
      );
    }

    if (this.shouldMirrorInMemory() || !this.isRedisBackendActive()) {
      this.pushLog(log);
      this.updateBucket(rota, input.statusCode, input.durationMs);
      this.bumpCounters(input.statusCode);
      this.traces.set(input.requestId, trace);
      this.traceOrder.push(input.requestId);
      if (this.traceOrder.length > MAX_TELEMETRY_TRACES) {
        const drop = this.traceOrder.shift();
        if (drop) this.traces.delete(drop);
      }
    }
  }

  private async persistRoundtripRedis(
    log: LogEstruturado,
    trace: TraceCompleto,
    rota: string,
    statusCode: number,
    durationMs: number,
  ): Promise<void> {
    if (!this.redis) return;

    await this.redis.lpush(OBS_TELEMETRY_LOGS, JSON.stringify(log));
    await this.redis.ltrim(OBS_TELEMETRY_LOGS, 0, MAX_TELEMETRY_LOGS - 1);
    await this.redis.expire(OBS_TELEMETRY_LOGS, TTL_TELEMETRY_LOGS_SEC);

    const bucketRaw = await this.redis.hgetall(OBS_TELEMETRY_BUCKETS);
    const bucket = parseBucket(bucketRaw[rota], rota);
    bucket.latenciaMsSum += durationMs;
    bucket.contagem += 1;
    bucket.status[statusCode] = (bucket.status[statusCode] ?? 0) + 1;
    await this.redis.hset(OBS_TELEMETRY_BUCKETS, rota, JSON.stringify(bucket));
    await this.redis.expire(OBS_TELEMETRY_BUCKETS, TTL_TELEMETRY_METRICS_SEC);

    const ctrField =
      statusCode >= 500 ? 'erro5xx' : statusCode >= 400 ? 'erro4xx' : 'sucesso2xx';
    await this.redis.hincrby(OBS_TELEMETRY_COUNTERS, 'totalReq', 1);
    await this.redis.hincrby(OBS_TELEMETRY_COUNTERS, ctrField, 1);
    await this.redis.expire(OBS_TELEMETRY_COUNTERS, TTL_TELEMETRY_METRICS_SEC);

    await this.redis.hset(OBS_TELEMETRY_TRACES, trace.requestId, JSON.stringify(trace));
    await this.redis.expire(OBS_TELEMETRY_TRACES, TTL_TELEMETRY_TRACES_SEC);
    await this.redis.lpush(OBS_TELEMETRY_TRACE_ORDER, trace.requestId);
    await this.redis.ltrim(OBS_TELEMETRY_TRACE_ORDER, 0, MAX_TELEMETRY_TRACES - 1);
    await this.redis.expire(OBS_TELEMETRY_TRACE_ORDER, TTL_TELEMETRY_TRACES_SEC);
  }

  async listLogs(filter?: {
    origem?: LogOrigem;
    severidade?: LogSeveridade;
    limit?: number;
  }): Promise<LogEstruturado[]> {
    const lim = Math.min(filter?.limit ?? 200, 500);
    if (this.isRedisBackendActive() && this.redis) {
      const lines = await this.redis.lrange(OBS_TELEMETRY_LOGS, 0, lim - 1);
      let rows = lines
        .map((line) => {
          try {
            return JSON.parse(line) as LogEstruturado;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as LogEstruturado[];
      if (filter?.origem) rows = rows.filter((l) => l.origem === filter.origem);
      if (filter?.severidade) rows = rows.filter((l) => l.severidade === filter.severidade);
      return rows;
    }

    let rows = [...this.logs].reverse();
    if (filter?.origem) rows = rows.filter((l) => l.origem === filter.origem);
    if (filter?.severidade) rows = rows.filter((l) => l.severidade === filter.severidade);
    return rows.slice(0, lim);
  }

  async getBuckets(): Promise<HttpMetricBucket[]> {
    if (this.isRedisBackendActive() && this.redis) {
      const raw = await this.redis.hgetall(OBS_TELEMETRY_BUCKETS);
      return Object.values(raw)
        .map((json) => {
          try {
            return JSON.parse(json) as HttpMetricBucket;
          } catch {
            return null;
          }
        })
        .filter(Boolean) as HttpMetricBucket[];
    }
    return [...this.buckets.values()];
  }

  async getContadoresGlobais() {
    if (this.isRedisBackendActive() && this.redis) {
      const raw = await this.redis.hgetall(OBS_TELEMETRY_COUNTERS);
      return {
        totalReq: Number(raw.totalReq ?? 0),
        sucesso2xx: Number(raw.sucesso2xx ?? 0),
        erro4xx: Number(raw.erro4xx ?? 0),
        erro5xx: Number(raw.erro5xx ?? 0),
      };
    }
    return {
      totalReq: this.totalReq,
      sucesso2xx: this.sucesso2xx,
      erro4xx: this.erro4xx,
      erro5xx: this.erro5xx,
    };
  }

  async getTrace(requestId: string): Promise<TraceCompleto | undefined> {
    if (this.isRedisBackendActive() && this.redis) {
      const raw = await this.redis.hget(OBS_TELEMETRY_TRACES, requestId);
      if (!raw) return undefined;
      try {
        return JSON.parse(raw) as TraceCompleto;
      } catch {
        return undefined;
      }
    }
    return this.traces.get(requestId);
  }

  async listTraces(limit = 50): Promise<TraceCompleto[]> {
    if (this.isRedisBackendActive() && this.redis) {
      const ids = await this.redis.lrange(OBS_TELEMETRY_TRACE_ORDER, 0, limit - 1);
      const out: TraceCompleto[] = [];
      for (const id of ids) {
        const t = await this.getTrace(id);
        if (t) out.push(t);
      }
      return out;
    }
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

  private pushLog(log: LogEstruturado) {
    this.logs.push(log);
    if (this.logs.length > MAX_TELEMETRY_LOGS) this.logs = this.logs.slice(-MAX_TELEMETRY_LOGS);
  }

  private updateBucket(rota: string, statusCode: number, durationMs: number) {
    let b = this.buckets.get(rota);
    if (!b) {
      b = { rotaNormalizada: rota, latenciaMsSum: 0, contagem: 0, status: {} };
      this.buckets.set(rota, b);
    }
    b.latenciaMsSum += durationMs;
    b.contagem += 1;
    b.status[statusCode] = (b.status[statusCode] ?? 0) + 1;
  }

  private bumpCounters(statusCode: number) {
    this.totalReq += 1;
    if (statusCode >= 500) this.erro5xx += 1;
    else if (statusCode >= 400) this.erro4xx += 1;
    else this.sucesso2xx += 1;
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

function parseBucket(raw: string | undefined, rota: string): HttpMetricBucket {
  if (!raw) {
    return { rotaNormalizada: rota, latenciaMsSum: 0, contagem: 0, status: {} };
  }
  try {
    const b = JSON.parse(raw) as HttpMetricBucket;
    return {
      rotaNormalizada: b.rotaNormalizada ?? rota,
      latenciaMsSum: b.latenciaMsSum ?? 0,
      contagem: b.contagem ?? 0,
      status: b.status ?? {},
    };
  } catch {
    return { rotaNormalizada: rota, latenciaMsSum: 0, contagem: 0, status: {} };
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
