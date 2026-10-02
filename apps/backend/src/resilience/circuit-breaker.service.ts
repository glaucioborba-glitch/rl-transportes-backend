import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { ObservabilityBridgeService } from '../observability/observability-bridge.service';
import { ResilienceMetricsService } from './resilience-metrics.service';
import {
  circuitStateKey,
  DEFAULT_CB_CONFIG,
  type CircuitBreakerConfig,
  type ResilienceServiceKey,
} from './resilience.constants';

export type CircuitPhase = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type SerializedCircuitState = {
  phase: CircuitPhase;
  consecutiveFailures: number;
  openedAt: number | null;
};

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly metrics: ResilienceMetricsService,
    private readonly bridge: ObservabilityBridgeService,
  ) {}

  private cfg(): CircuitBreakerConfig {
    return DEFAULT_CB_CONFIG;
  }

  private enabled(): boolean {
    return this.config.get<string>('RESILIENCE_ENABLED', '1') !== '0';
  }

  private async readState(service: ResilienceServiceKey): Promise<SerializedCircuitState> {
    try {
      const raw = await this.redis.get(circuitStateKey(service));
      if (!raw) {
        return { phase: 'CLOSED', consecutiveFailures: 0, openedAt: null };
      }
      const j = JSON.parse(raw) as SerializedCircuitState;
      return {
        phase: j.phase === 'OPEN' || j.phase === 'HALF_OPEN' ? j.phase : 'CLOSED',
        consecutiveFailures: Math.max(0, Number(j.consecutiveFailures) || 0),
        openedAt: typeof j.openedAt === 'number' ? j.openedAt : null,
      };
    } catch {
      return { phase: 'CLOSED', consecutiveFailures: 0, openedAt: null };
    }
  }

  private async writeState(service: ResilienceServiceKey, s: SerializedCircuitState): Promise<void> {
    try {
      await this.redis.setPersist(circuitStateKey(service), JSON.stringify(s));
    } catch (e) {
      this.logger.warn(`cb write ${service}: ${(e as Error).message}`);
    }
  }

  /**
   * HALF_OPEN primeiro; OPEN em cooldown bloqueia; após cooldown → HALF_OPEN e libera 1 leva de requests.
   */
  async shouldShortCircuit(service: ResilienceServiceKey): Promise<{
    block: boolean;
    retryAfterMs?: number;
  }> {
    if (!this.enabled()) return { block: false };

    const { cooldownMs } = this.cfg();
    let s = await this.readState(service);
    const now = Date.now();

    if (s.phase === 'HALF_OPEN') {
      return { block: false };
    }

    if (s.phase === 'OPEN' && s.openedAt != null) {
      const elapsed = now - s.openedAt;
      if (elapsed < cooldownMs) {
        return { block: true, retryAfterMs: cooldownMs - elapsed };
      }
      const next: SerializedCircuitState = {
        phase: 'HALF_OPEN',
        consecutiveFailures: s.consecutiveFailures,
        openedAt: s.openedAt,
      };
      await this.writeState(service, next);
      await this.metrics.recordCircuitTransition(service, 'HALF_OPEN');
      this.bridge.emit({
        type: 'CIRCUIT_EVENT',
        payload: {
          service,
          phase: 'HALF_OPEN',
          timestamp: new Date().toISOString(),
        },
      });
      return { block: false };
    }

    return { block: false };
  }

  async recordSuccess(service: ResilienceServiceKey): Promise<void> {
    if (!this.enabled()) return;

    const s = await this.readState(service);
    if (s.phase === 'HALF_OPEN') {
      await this.writeState(service, { phase: 'CLOSED', consecutiveFailures: 0, openedAt: null });
      await this.metrics.recordCircuitTransition(service, 'CLOSED');
      this.bridge.emit({
        type: 'CIRCUIT_EVENT',
        payload: {
          service,
          phase: 'CLOSED',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
    if (s.phase === 'CLOSED' && s.consecutiveFailures > 0) {
      await this.writeState(service, { ...s, consecutiveFailures: 0 });
    }
  }

  async recordFailure(service: ResilienceServiceKey): Promise<void> {
    if (!this.enabled()) return;

    const { threshold, cooldownMs } = this.cfg();
    let s = await this.readState(service);
    const now = Date.now();

    if (s.phase === 'HALF_OPEN') {
      const openedAt = now;
      await this.writeState(service, {
        phase: 'OPEN',
        consecutiveFailures: threshold,
        openedAt,
      });
      await this.metrics.recordCircuitOpen(service, cooldownMs);
      this.bridge.emit({
        type: 'CIRCUIT_EVENT',
        payload: {
          service,
          phase: 'OPEN',
          retryAfterMs: cooldownMs,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    const failures = s.consecutiveFailures + 1;
    if (failures >= threshold) {
      await this.writeState(service, {
        phase: 'OPEN',
        consecutiveFailures: 0,
        openedAt: now,
      });
      await this.metrics.recordCircuitOpen(service, cooldownMs);
      this.bridge.emit({
        type: 'CIRCUIT_EVENT',
        payload: {
          service,
          phase: 'OPEN',
          retryAfterMs: cooldownMs,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      await this.writeState(service, { ...s, consecutiveFailures: failures });
    }
  }

  async listStates(): Promise<Record<string, SerializedCircuitState>> {
    const keys: ResilienceServiceKey[] = ['security', 'portal', 'financeiro', 'agendamentos', 'auditoria', 'core'];
    const out: Record<string, SerializedCircuitState> = {};
    for (const k of keys) {
      out[k] = await this.readState(k);
    }
    return out;
  }
}
