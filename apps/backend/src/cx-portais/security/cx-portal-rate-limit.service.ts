import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { RedisService } from '../../redis/redis.service';
import type { CxPortalRequestUser } from '../types/cx-portal.types';

const WINDOW_SEC = 60;
const MAX_PER_WINDOW = 240;
const MINHAS_PERMISSOES_MAX = 10;
const PREFIX = 'cx-portal:rl:';

/** Fallback in-process quando Redis indisponível (dev). */
const memBuckets = new Map<string, { count: number; windowStart: number }>();

function isMinhasPermissoesRoute(req: Request): boolean {
  const raw = (req as Request & { path?: string }).path || req.url || '';
  return raw.includes('minhas-permissoes');
}

@Injectable()
export class CxPortalRateLimitService {
  private readonly logger = new Logger(CxPortalRateLimitService.name);

  constructor(private readonly redis: RedisService) {}

  /** Rate limit distribuído (Redis) com fallback memória local. */
  async poke(req: Request, user?: CxPortalRequestUser): Promise<void> {
    const max = isMinhasPermissoesRoute(req) ? MINHAS_PERMISSOES_MAX : MAX_PER_WINDOW;
    const ip = (req.ip || req.socket.remoteAddress || '').slice(0, 64);
    const bucket = isMinhasPermissoesRoute(req) ? 'minhas-perm' : 'api';
    const window = Math.floor(Date.now() / (WINDOW_SEC * 1000));
    const key = `${PREFIX}${bucket}:${user?.sub ?? 'anon'}:${ip}:${window}`;

    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, WINDOW_SEC);
      }
      if (count > max) {
        throw new HttpException('Limite de requisições do portal CX excedido', HttpStatus.TOO_MANY_REQUESTS);
      }
      return;
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.warn(`Rate limit Redis indisponível — fallback memória (${(e as Error).message})`);
    }

    this.pokeMemory(key, max);
  }

  private pokeMemory(key: string, max: number): void {
    const now = Date.now();
    let b = memBuckets.get(key);
    if (!b || now - b.windowStart > WINDOW_SEC * 1000) {
      b = { count: 0, windowStart: now };
      memBuckets.set(key, b);
    }
    b.count += 1;
    if (b.count > max) {
      throw new HttpException('Limite de requisições do portal CX excedido', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
