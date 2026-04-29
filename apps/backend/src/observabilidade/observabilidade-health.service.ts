import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { HealthStatusSignal } from './observabilidade.types';

export interface HealthDetalhadoDto {
  sinal: HealthStatusSignal;
  timestamp: string;
  uptimeSec: number;
  banco: {
    pingMs: number | null;
    ok: boolean;
    mensagem?: string;
  };
  redis: {
    pingMs: number | null;
    ok: boolean;
    mensagem?: string;
  };
  processo: {
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
  };
  /** proxies opcionais sem alterar outros módulos */
  integracao: {
    webhookQueueDepthProxy: number | null;
    iaExecucaoMsProxy: number | null;
    fiscalRespondeProxy: boolean | null;
  };
}

@Injectable()
export class ObservabilidadeHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async detalhado(): Promise<HealthDetalhadoDto> {
    const timestamp = new Date().toISOString();
    const mem = process.memoryUsage();
    const uptimeSec = Math.round(process.uptime());

    let dbPing: number | null = null;
    let dbOk = false;
    try {
      const t0 = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbPing = Date.now() - t0;
      dbOk = true;
    } catch (e) {
      dbOk = false;
    }

    let redisPing: number | null = null;
    let redisOk = false;
    try {
      const t0 = Date.now();
      const pong = await this.redis.ping();
      redisPing = Date.now() - t0;
      redisOk = pong === 'PONG';
    } catch {
      redisOk = false;
    }

    const webhookQ = parseFloat(this.config.get<string>('OBS_WEBHOOK_QUEUE_DEPTH_PROXY') ?? '');
    const iaMs = parseFloat(this.config.get<string>('OBS_IA_EXEC_MS_PROXY') ?? '');
    const fiscalOkEnv = this.config.get<string>('OBS_FISCAL_HEALTH_PROXY');

    const sinal = computeSignal(dbOk, redisOk, dbPing, redisPing);

    return {
      sinal,
      timestamp,
      uptimeSec,
      banco: {
        pingMs: dbPing,
        ok: dbOk,
        mensagem: dbOk ? undefined : 'Falha ao executar SELECT 1',
      },
      redis: {
        pingMs: redisPing,
        ok: redisOk,
        mensagem: redisOk ? undefined : 'Redis indisponível',
      },
      processo: {
        rssBytes: mem.rss,
        heapTotalBytes: mem.heapTotal,
        heapUsedBytes: mem.heapUsed,
        externalBytes: mem.external,
      },
      integracao: {
        webhookQueueDepthProxy: Number.isFinite(webhookQ) ? webhookQ : null,
        iaExecucaoMsProxy: Number.isFinite(iaMs) ? iaMs : null,
        fiscalRespondeProxy:
          fiscalOkEnv === '1' ? true : fiscalOkEnv === '0' ? false : null,
      },
    };
  }

  async simples(): Promise<{ status: string; sinal: HealthStatusSignal; timestamp: string }> {
    const d = await this.detalhado();
    return {
      status: d.sinal === 'OK' ? 'ok' : d.sinal === 'DEGRADED' ? 'degraded' : 'fail',
      sinal: d.sinal,
      timestamp: d.timestamp,
    };
  }
}

function computeSignal(
  dbOk: boolean,
  redisOk: boolean,
  dbPing: number | null,
  redisPing: number | null,
): HealthStatusSignal {
  if (!dbOk || !redisOk) return 'FAIL';
  const slowDb = dbPing != null && dbPing > 800;
  const slowRedis = redisPing != null && redisPing > 200;
  if (slowDb || slowRedis) return 'DEGRADED';
  return 'OK';
}
