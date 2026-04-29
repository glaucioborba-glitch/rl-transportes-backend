import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { CxPortalRequestUser } from '../types/cx-portal.types';

const buckets = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 240;

@Injectable()
export class CxPortalRateLimitService {
  /** Por sub (+ IP fraca) para anti-DOS básico. */
  poke(req: Request, user?: CxPortalRequestUser) {
    const ip = (req.ip || req.socket.remoteAddress || '').slice(0, 64);
    const key = `${user?.sub ?? 'anon'}:${ip}:${Math.floor(Date.now() / WINDOW_MS)}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now - b.windowStart > WINDOW_MS) {
      b = { count: 0, windowStart: now };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > MAX_PER_WINDOW) {
      throw new HttpException('Limite de requisições do portal CX excedido', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
