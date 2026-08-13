import { Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

const DEFAULT_TTL_SEC = 300;

/** Cache Redis para configs CX/tenant — PostgreSQL permanece fonte da verdade. */
@Injectable()
export class ConfigCacheService {
  constructor(private readonly redis: RedisService) {}

  key(prefix: string, id: string): string {
    return `cfg:${prefix}:${id}`;
  }

  async get<T>(cacheKey: string): Promise<T | null> {
    const raw = await this.redis.get(cacheKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(cacheKey: string, value: unknown, ttlSec = DEFAULT_TTL_SEC): Promise<void> {
    await this.redis.setex(cacheKey, ttlSec, JSON.stringify(value));
  }

  async invalidate(cacheKey: string): Promise<void> {
    await this.redis.del(cacheKey);
  }
}
