import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ChaosPathGroup = 'security' | 'agendamentos' | 'solicitacoes';

export type ChaosTimelineEntry = {
  at: string;
  kind: string;
  detail: Record<string, unknown>;
};

/** TTL máximo de qualquer sabotagem sintética (30s). */
export const CHAOS_MAX_MS = 30_000;

const PREFIX_BY_GROUP: Record<ChaosPathGroup, string> = {
  security: '/cliente/security',
  agendamentos: '/v1/agendamentos',
  solicitacoes: '/solicitacoes',
};

@Injectable()
export class ChaosGateService {
  private dbRejectUntil = 0;
  private redisFreezeUntil = 0;
  private redisLatencyExtraMs = 0;
  private redisLatencyUntil = 0;
  private latencyRules: Array<{ prefix: string; ms: number; until: number }> = [];
  private routeBlocks: Array<{ prefix: string; status: number; until: number }> = [];
  private timeline: ChaosTimelineEntry[] = [];

  constructor(private readonly config: ConfigService) {}

  /**
   * DEV/QA ou CHAOS_ENGINE_ENABLED=1. Produção com CHAOS_ENGINE_ENABLED=0 fica desligado.
   * Produção com NODE_ENV=production só permite se DEPLOY_ENV ∈ {qa,staging,homolog,hml}.
   */
  isChaosEnvironment(): boolean {
    if (this.config.get<string>('CHAOS_ENGINE_ENABLED') === '1') return true;
    if (this.config.get<string>('CHAOS_ENGINE_ENABLED') === '0') return false;
    if (this.config.get<string>('NODE_ENV') !== 'production') return true;
    const d = (this.config.get<string>('DEPLOY_ENV') || '').toLowerCase();
    return d === 'qa' || d === 'staging' || d === 'homolog' || d === 'hml';
  }

  clampDuration(ms: number, fallback: number): number {
    const v = Number.isFinite(ms) && ms > 0 ? ms : fallback;
    return Math.min(Math.max(v, 100), CHAOS_MAX_MS);
  }

  private pushTimeline(kind: string, detail: Record<string, unknown>): void {
    this.timeline.unshift({ at: new Date().toISOString(), kind, detail });
    this.timeline = this.timeline.slice(0, 200);
  }

  getTimeline(): ChaosTimelineEntry[] {
    return [...this.timeline];
  }

  assertDbAvailable(): void {
    if (Date.now() < this.dbRejectUntil) {
      throw new Error('CHAOS_DB_SYNTHETIC');
    }
  }

  isDbChaosActive(): boolean {
    return Date.now() < this.dbRejectUntil;
  }

  /** Congelamento / latência artificial antes de cada operação Redis. */
  async applyRedisChaos(): Promise<void> {
    while (Date.now() < this.redisFreezeUntil) {
      await new Promise((r) => setTimeout(r, 15));
    }
    if (Date.now() < this.redisLatencyUntil && this.redisLatencyExtraMs > 0) {
      await new Promise((r) => setTimeout(r, this.redisLatencyExtraMs));
    }
  }

  setDbFailure(ms: number): number {
    const d = this.clampDuration(ms, 2000);
    this.dbRejectUntil = Date.now() + d;
    this.pushTimeline('DB_FAILURE', { ms: d });
    return d;
  }

  setRedisFreeze(ms: number): number {
    const d = this.clampDuration(ms, 2000);
    this.redisFreezeUntil = Date.now() + d;
    this.pushTimeline('REDIS_FREEZE', { ms: d });
    return d;
  }

  setRedisLatency(msPerOp: number, durationMs: number): void {
    const op = Math.min(Math.max(msPerOp, 0), 5_000);
    const dur = this.clampDuration(durationMs, 10_000);
    this.redisLatencyExtraMs = op;
    this.redisLatencyUntil = Date.now() + dur;
    this.pushTimeline('REDIS_LATENCY', { msPerOp: op, durationMs: dur });
  }

  setLatencyForPrefixes(prefixes: string[], ms: number, durationMs: number): void {
    const dur = this.clampDuration(durationMs, 15_000);
    const until = Date.now() + dur;
    const clampedMs = Math.min(Math.max(ms, 0), 10_000);
    for (const p of prefixes) {
      const prefix = p.startsWith('/') ? p : `/${p}`;
      this.latencyRules.push({ prefix, ms: clampedMs, until });
    }
    this.pushTimeline('HTTP_LATENCY', { prefixes, ms: clampedMs, durationMs: dur });
  }

  resolvePrefixesFromGroups(targets: ChaosPathGroup[]): string[] {
    const out: string[] = [];
    for (const t of targets) {
      const p = PREFIX_BY_GROUP[t];
      if (p) out.push(p);
    }
    return out;
  }

  extraLatencyForPath(path: string): number {
    const now = Date.now();
    this.latencyRules = this.latencyRules.filter((r) => r.until > now);
    const p = (path.split('?')[0] || '/').trim();
    let max = 0;
    for (const r of this.latencyRules) {
      if (p === r.prefix || p.startsWith(`${r.prefix}/`)) {
        max = Math.max(max, r.ms);
      }
    }
    return max;
  }

  addRouteBlock(pathPrefix: string, status: number, durationMs: number): void {
    const dur = this.clampDuration(durationMs, 20_000);
    const st = status === 504 ? 504 : 503;
    const prefix = pathPrefix.startsWith('/') ? pathPrefix : `/${pathPrefix}`;
    this.routeBlocks.push({ prefix, status: st, until: Date.now() + dur });
    this.pushTimeline('ROUTE_BLOCK', { pathPrefix: prefix, status: st, durationMs: dur });
  }

  matchRouteBlock(path: string): { status: number } | null {
    const now = Date.now();
    this.routeBlocks = this.routeBlocks.filter((b) => b.until > now);
    const p = (path.split('?')[0] || '/').trim();
    for (const b of this.routeBlocks) {
      if (p === b.prefix || p.startsWith(`${b.prefix}/`)) {
        return { status: b.status };
      }
    }
    return null;
  }

  /** Turbulência: falha DB curta + latência Redis + bloqueio de rota (security). */
  startTurbulence(durationMs: number): number {
    const dur = this.clampDuration(durationMs, 10_000);
    this.dbRejectUntil = Date.now() + 2000;
    this.redisLatencyExtraMs = 120;
    this.redisLatencyUntil = Date.now() + dur;
    this.routeBlocks.push({ prefix: '/cliente/security', status: 504, until: Date.now() + dur });
    this.pushTimeline('TURBULENCE', { durationMs: dur, dbMs: 2000, redisLatencyMs: 120, blocked: '/cliente/security' });
    return dur;
  }

  reset(): void {
    this.dbRejectUntil = 0;
    this.redisFreezeUntil = 0;
    this.redisLatencyExtraMs = 0;
    this.redisLatencyUntil = 0;
    this.latencyRules = [];
    this.routeBlocks = [];
    this.pushTimeline('RESET', {});
  }

  getSnapshot(): Record<string, unknown> {
    const now = Date.now();
    return {
      engineAllowed: this.isChaosEnvironment(),
      dbRejectUntil: this.dbRejectUntil,
      dbActiveMsRemaining: Math.max(0, this.dbRejectUntil - now),
      redisFreezeUntil: this.redisFreezeUntil,
      redisFreezeMsRemaining: Math.max(0, this.redisFreezeUntil - now),
      redisLatency: {
        until: this.redisLatencyUntil,
        msRemaining: Math.max(0, this.redisLatencyUntil - now),
        msPerOp: this.redisLatencyExtraMs,
      },
      activeRouteBlocks: this.routeBlocks.filter((b) => b.until > now),
      activeLatencyRules: this.latencyRules.filter((r) => r.until > now),
      timeline: this.getTimeline().slice(0, 50),
    };
  }
}
