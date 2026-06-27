import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import {
  OBS_ERRORS_LIST,
  OBS_FAIL_HEAT_PREFIX,
  OBS_LATENCY_LIST,
  OBS_ROUTE_RANK_Z,
  OBS_THROUGHPUT_MIN_PREFIX,
  OBS_USER_RANK_Z,
} from './observability.constants';
import type { LatencySample } from './metrics.service';
import type { StoredError } from './logs.service';

function percentile(sortedMs: number[], p: number): number {
  if (!sortedMs.length) return 0;
  const idx = Math.min(sortedMs.length - 1, Math.max(0, Math.ceil((p / 100) * sortedMs.length) - 1));
  return sortedMs[idx] ?? 0;
}

@Injectable()
export class ObservabilityPerformanceService {
  private readonly logger = new Logger(ObservabilityPerformanceService.name);
  private readonly isProd: boolean;

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    this.isProd = (this.config.get<string>('NODE_ENV') ?? 'development') === 'production';
  }

  async getLatencyRecent(): Promise<Array<{ route: string; ms: number; status: number }>> {
    try {
      const raw = await this.redis.lrange(OBS_LATENCY_LIST, 0, 99);
      const out: Array<{ route: string; ms: number; status: number }> = [];
      for (const line of raw) {
        try {
          const j = JSON.parse(line) as LatencySample;
          out.push({ route: j.route, ms: j.ms, status: j.status });
        } catch {
          /* ignore */
        }
      }
      return out;
    } catch (e) {
      if (!this.isProd) this.logger.warn(`latency read: ${(e as Error).message}`);
      return [];
    }
  }

  async getLatencyAggregates(): Promise<{
    avgMs: number;
    p95Ms: number;
    p99Ms: number;
    byRoute: Array<{ route: string; avgMs: number; p95Ms: number; p99Ms: number; count: number }>;
  }> {
    const raw = await this.redis.lrange(OBS_LATENCY_LIST, 0, 99);
    const samples: LatencySample[] = [];
    for (const line of raw) {
      try {
        samples.push(JSON.parse(line) as LatencySample);
      } catch {
        /* */
      }
    }
    const msAll = samples.map((s) => s.ms).sort((a, b) => a - b);
    const avgMs = msAll.length ? Math.round(msAll.reduce((a, b) => a + b, 0) / msAll.length) : 0;

    const byRouteMap = new Map<string, number[]>();
    for (const s of samples) {
      const arr = byRouteMap.get(s.route) ?? [];
      arr.push(s.ms);
      byRouteMap.set(s.route, arr);
    }
    const byRoute: Array<{ route: string; avgMs: number; p95Ms: number; p99Ms: number; count: number }> = [];
    for (const [route, arr] of byRouteMap) {
      const sorted = [...arr].sort((a, b) => a - b);
      byRoute.push({
        route,
        count: sorted.length,
        avgMs: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
        p95Ms: percentile(sorted, 95),
        p99Ms: percentile(sorted, 99),
      });
    }
    byRoute.sort((a, b) => b.count - a.count);

    return {
      avgMs,
      p95Ms: percentile(msAll, 95),
      p99Ms: percentile(msAll, 99),
      byRoute: byRoute.slice(0, 40),
    };
  }

  async listErrors(limit = 80): Promise<StoredError[]> {
    try {
      const raw = await this.redis.lrange(OBS_ERRORS_LIST, 0, Math.min(limit, 200) - 1);
      const out: StoredError[] = [];
      for (const line of raw) {
        try {
          out.push(JSON.parse(line) as StoredError);
        } catch {
          /* */
        }
      }
      return out;
    } catch (e) {
      if (!this.isProd) this.logger.warn(`errors read: ${(e as Error).message}`);
      return [];
    }
  }

  async getServicesRanking(top = 25): Promise<Array<{ route: string; count: number }>> {
    try {
      const rows = await this.redis.zrevrangeWithScores(OBS_ROUTE_RANK_Z, 0, top - 1);
      return rows.map((r) => ({ route: r.member, count: Math.round(r.score) }));
    } catch (e) {
      if (!this.isProd) this.logger.warn(`rank: ${(e as Error).message}`);
      return [];
    }
  }

  async getTopUsers(top = 15): Promise<Array<{ userId: string; count: number }>> {
    try {
      const rows = await this.redis.zrevrangeWithScores(OBS_USER_RANK_Z, 0, top - 1);
      return rows.map((r) => ({ userId: r.member, count: Math.round(r.score) }));
    } catch {
      return [];
    }
  }

  /** Requisições por minuto nos últimos `minutes` buckets (1 bucket = 1 min UTC). */
  async getThroughputSeries(minutes = 45): Promise<Array<{ minute: string; count: number }>> {
    const nowMin = Math.floor(Date.now() / 60_000);
    const out: Array<{ minute: string; count: number }> = [];
    for (let i = minutes - 1; i >= 0; i -= 1) {
      const b = nowMin - i;
      const key = `${OBS_THROUGHPUT_MIN_PREFIX}${b}`;
      try {
        const raw = await this.redis.get(key);
        const count = raw ? Number(raw) : 0;
        const d = new Date(b * 60_000);
        out.push({
          minute: d.toISOString(),
          count: Number.isFinite(count) ? count : 0,
        });
      } catch {
        out.push({ minute: new Date(b * 60_000).toISOString(), count: 0 });
      }
    }
    return out;
  }

  /** Heatmap 24h: eixo Y = rotas (top), eixo X = 24 horas UTC, valor = falhas. */
  async getFailureHeatmap24h(): Promise<{
    routes: string[];
    hoursUtc: string[];
    matrix: number[][];
  }> {
    const routesSet = new Set<string>();
    const hourKeys: string[] = [];
    for (let h = 23; h >= 0; h -= 1) {
      const d = new Date(Date.now() - h * 3600 * 1000);
      const key = `${OBS_FAIL_HEAT_PREFIX}${this.hourKeyUTC(d)}`;
      hourKeys.push(key);
      try {
        const hash = await this.redis.hgetall(key);
        for (const r of Object.keys(hash)) {
          routesSet.add(r);
        }
      } catch {
        /* */
      }
    }

    const routes = [...routesSet].slice(0, 35);
    const hoursUtc = hourKeys.map((k) => k.replace(OBS_FAIL_HEAT_PREFIX, ''));

    const matrix: number[][] = routes.map(() => hourKeys.map(() => 0));
    for (let col = 0; col < hourKeys.length; col += 1) {
      try {
        const hash = await this.redis.hgetall(hourKeys[col]!);
        for (let ri = 0; ri < routes.length; ri += 1) {
          const route = routes[ri]!;
          const v = hash[route];
          matrix[ri]![col] = v ? Number(v) : 0;
        }
      } catch {
        /* */
      }
    }

    return { routes, hoursUtc, matrix };
  }

  private hourKeyUTC(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    return `${y}${m}${day}${h}`;
  }
}
