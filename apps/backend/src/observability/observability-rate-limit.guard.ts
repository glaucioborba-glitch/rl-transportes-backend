import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { RedisService } from '../redis/redis.service';

/** Até 5 requisições por segundo por usuário autenticado (ou IP). */
@Injectable()
export class ObservabilityRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
    const uid = req.user?.id ?? req.ip ?? 'anon';
    const sec = Math.floor(Date.now() / 1000);
    const key = `obs:rl:v1:${uid}:${sec}`;
    try {
      const n = await this.redis.incr(key);
      if (n === 1) await this.redis.expire(key, 3);
      if (n > 5) throw new HttpException('Rate limit observabilidade (5 req/s)', HttpStatus.TOO_MANY_REQUESTS);
    } catch (e) {
      if (e instanceof HttpException && e.getStatus() === HttpStatus.TOO_MANY_REQUESTS) throw e;
      return true;
    }
    return true;
  }
}
