import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async ping(key = 'redis'): Promise<HealthIndicatorResult> {
    const started = Date.now();
    try {
      const pong = await this.redis.ping();
      const ok = pong === 'PONG';
      if (!ok) {
        throw new HealthCheckError('Redis respondeu inesperadamente', this.getStatus(key, false));
      }
      // O modo memória também responde PONG: sem isso o health mente com o Redis fora.
      if (this.redis.isMemoryFallback()) {
        const detalhe = this.getStatus(key, false, {
          modo: 'memoria',
          message: 'Redis indisponível — cache e rate limit em memória local.',
        });
        if (process.env.NODE_ENV === 'production') {
          throw new HealthCheckError('Redis em fallback de memória', detalhe);
        }
        return this.getStatus(key, true, { modo: 'memoria', latencyMs: Date.now() - started });
      }
      return this.getStatus(key, true, { latencyMs: Date.now() - started });
    } catch (e) {
      if (e instanceof HealthCheckError) throw e;
      throw new HealthCheckError(
        'Redis indisponível',
        this.getStatus(key, false, { message: (e as Error).message }),
      );
    }
  }
}
