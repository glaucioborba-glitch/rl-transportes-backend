import { Injectable } from '@nestjs/common';
import type { PlataformaApiClient } from '../plataforma.types';

interface Bucket {
  count: number;
  resetAt: number;
}

/** Throttling individual por cliente API (janela 60s, limite vindo do cadastro). */
@Injectable()
export class PlataformaRateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  consume(client: PlataformaApiClient): boolean {
    const max = Math.max(1, client.requestsPerMinute);
    const key = client.id;
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + 60_000 };
      this.buckets.set(key, b);
    }
    if (b.count >= max) return false;
    b.count += 1;
    return true;
  }
}
