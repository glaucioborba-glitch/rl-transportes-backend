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
