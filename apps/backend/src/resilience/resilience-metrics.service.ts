import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import type { ResilienceServiceKey } from './resilience.constants';
import { RES_MET_FALLBACK_COUNT, RES_MET_RECOVERY_LOG, RES_MET_TIMELINE } from './resilience.constants';

/** Métricas Redis para o Observability Center (circuitos, fallbacks, recovery). */
@Injectable()
export class ResilienceMetricsService {
  constructor(private readonly redis: RedisService) {}

  async recordCircuitTransition(service: ResilienceServiceKey, phase: string): Promise<void> {
    try {
      const line = JSON.stringify({
        kind: 'circuit',
        service,
        phase,
        at: new Date().toISOString(),
      });
      await this.redis.lpush(RES_MET_TIMELINE, line);
      await this.redis.ltrim(RES_MET_TIMELINE, 0, 299);
      await this.redis.expire(RES_MET_TIMELINE, 86400);
    } catch {
      /* */
    }
  }

  /** Incrementa contador de tempo “abaixo” por serviço (aprox. para média OPEN). */
  async recordCircuitOpen(service: ResilienceServiceKey, cooldownMs: number): Promise<void> {
    try {
      await this.redis.hincrby(`res:v1:cb:open:acc`, service, cooldownMs);
      await this.redis.hincrby(`res:v1:cb:open:n`, service, 1);
      await this.redis.expire(`res:v1:cb:open:acc`, 172800);
      await this.redis.expire(`res:v1:cb:open:n`, 172800);
      await this.recordCircuitTransition(service, 'OPEN');
    } catch {
      /* */
    }
  }

  async recordFallback(service: ResilienceServiceKey, path: string): Promise<void> {
    try {
      await this.redis.hincrby(RES_MET_FALLBACK_COUNT, service, 1);
      await this.redis.expire(RES_MET_FALLBACK_COUNT, 172800);
      const line = JSON.stringify({
        kind: 'fallback',
        service,
        path: path.slice(0, 400),
        at: new Date().toISOString(),
      });
      await this.redis.lpush(RES_MET_TIMELINE, line);
      await this.redis.ltrim(RES_MET_TIMELINE, 0, 299);
      await this.redis.expire(RES_MET_TIMELINE, 86400);
    } catch {
      /* */
    }
  }

  async recordRecoveryEvent(
    phase: 'RECOVERY_ATTEMPT' | 'RECOVERY_SUCCESS' | 'RECOVERY_FAILED',
    target: string,
    detail?: string,
  ): Promise<void> {
    try {
      const line = JSON.stringify({
        kind: phase,
        target,
        detail: detail?.slice(0, 500),
        at: new Date().toISOString(),
      });
      await this.redis.lpush(RES_MET_RECOVERY_LOG, line);
      await this.redis.ltrim(RES_MET_RECOVERY_LOG, 0, 199);
      await this.redis.expire(RES_MET_RECOVERY_LOG, 172800);
    } catch {
      /* */
    }
  }

  async getDashboardSnapshot(): Promise<{
    fallbackCountByService: Record<string, number>;
    circuitOpenStats: Record<string, { totalCooldownMs: number; opens: number; avgOpenMs: number }>;
    timeline: unknown[];
    recoveryLog: unknown[];
  }> {
    const [fh, accHash, nHash, tl, rl] = await Promise.all([
      this.redis.hgetall(RES_MET_FALLBACK_COUNT),
      this.redis.hgetall(`res:v1:cb:open:acc`),
      this.redis.hgetall(`res:v1:cb:open:n`),
      this.redis.lrange(RES_MET_TIMELINE, 0, 99),
      this.redis.lrange(RES_MET_RECOVERY_LOG, 0, 79),
    ]);

    const fallbackCountByService: Record<string, number> = {};
    for (const [k, v] of Object.entries(fh)) {
      fallbackCountByService[k] = Number(v) || 0;
    }

    const circuitOpenStats: Record<string, { totalCooldownMs: number; opens: number; avgOpenMs: number }> = {};
    const services = new Set([...Object.keys(accHash), ...Object.keys(nHash)]);
    for (const s of services) {
      const total = Number(accHash[s] ?? 0);
      const n = Number(nHash[s] ?? 0);
      circuitOpenStats[s] = {
        totalCooldownMs: total,
        opens: n,
        avgOpenMs: n > 0 ? Math.round(total / n) : 0,
      };
    }

    const timeline = tl
      .map((line) => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return line;
        }
      })
      .filter(Boolean);

    const recoveryLog = rl
      .map((line) => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return line;
        }
      })
      .filter(Boolean);

    return { fallbackCountByService, circuitOpenStats, timeline, recoveryLog };
  }
}
