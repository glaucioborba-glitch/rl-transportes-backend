import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface Bucket {
  count: number;
  resetAt: number;
}

/** Rate limit por chave (API Key ou IP) — em memória; janela fixa 1 minuto. */
@Injectable()
export class IntegracaoRateLimitService {
  private readonly buckets = new Map<string, Bucket>();
  private readonly maxPerMinute: number;

  constructor(private readonly config: ConfigService) {
    this.maxPerMinute = Math.max(
      1,
      parseInt(this.config.get<string>('INTEGRACAO_RATE_LIMIT_PER_MIN') ?? '120', 10) || 120,
    );
  }

  /** Retorna true se permitido; incrementa contador. */
  consume(key: string): boolean {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + 60_000 };
      this.buckets.set(key, b);
    }
    if (b.count >= this.maxPerMinute) return false;
    b.count += 1;
    return true;
  }
}
