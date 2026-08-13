import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ObservabilityBridgeService } from '../observability/observability-bridge.service';
import { ResilienceMetricsService } from './resilience-metrics.service';
import { probeSecurityEngineStatus } from '../health/security-engine-probe.util';

const BACKOFF_MS = [100, 200, 400, 800, 1600, 3200, 5000];

/** Tentativas periódicas de saneamento com backoff exponencial (Redis, DB, Security Engine). */
@Injectable()
export class AutoRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutoRecoveryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private readonly streak = new Map<string, number>();

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly metrics: ResilienceMetricsService,
    private readonly bridge: ObservabilityBridgeService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('RESILIENCE_AUTO_RECOVERY', '1') === '0') return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 45_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Chaos Monkey / health: força um ciclo de probe imediato (fora do intervalo de 45s). */
  async forceProbeCycle(): Promise<void> {
    await this.tick();
  }

  private async tick(): Promise<void> {
    await Promise.all([
      this.probeTarget('redis', () => this.redis.ping().then((p) => p === 'PONG')),
      this.probeTarget('database', () =>
        this.prisma.$queryRaw`SELECT 1`.then(() => true),
      ),
      this.probeTarget('security-engine', () =>
        probeSecurityEngineStatus(this.redis, this.prisma).then((s) => s !== 'offline'),
      ),
    ]);
  }

  private async probeTarget(name: string, fn: () => Promise<boolean>): Promise<void> {
    const st = this.streak.get(name) ?? 0;
    const delay = BACKOFF_MS[Math.min(st, BACKOFF_MS.length - 1)] ?? 5000;

    this.bridge.emit({
      type: 'RECOVERY_EVENT',
      payload: {
        phase: 'RECOVERY_ATTEMPT',
        target: name,
        backoffMs: delay,
        timestamp: new Date().toISOString(),
      },
    });
    await this.metrics.recordRecoveryEvent('RECOVERY_ATTEMPT', name, `backoff=${delay}`);

    await new Promise((r) => setTimeout(r, Math.min(delay, 500)));

    try {
      const ok = await fn();
      if (ok) {
        this.streak.set(name, 0);
        this.bridge.emit({
          type: 'RECOVERY_EVENT',
          payload: {
            phase: 'RECOVERY_SUCCESS',
            target: name,
            timestamp: new Date().toISOString(),
          },
        });
        await this.metrics.recordRecoveryEvent('RECOVERY_SUCCESS', name);
      } else {
        throw new Error('probe returned false');
      }
    } catch (e) {
      const next = (this.streak.get(name) ?? 0) + 1;
      this.streak.set(name, next);
      const msg = (e as Error).message?.slice(0, 400);
      this.bridge.emit({
        type: 'RECOVERY_EVENT',
        payload: {
          phase: 'RECOVERY_FAILED',
          target: name,
          detail: msg,
          timestamp: new Date().toISOString(),
        },
      });
      await this.metrics.recordRecoveryEvent('RECOVERY_FAILED', name, msg);
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        this.logger.verbose(`recovery ${name} failed streak=${next}`);
      }
    }
  }
}
