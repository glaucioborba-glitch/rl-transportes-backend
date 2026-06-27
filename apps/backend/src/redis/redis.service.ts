import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ChaosGateService } from '../chaos/chaos-gate.service';

type MemString = { kind: 'string'; value: string; expiresAt?: number };
type MemList = { kind: 'list'; items: string[] };
type MemHash = { kind: 'hash'; fields: Record<string, string> };
type MemEntry = MemString | MemList | MemHash;

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  /** Em dev local sem Docker: degrada para store em memória em vez de derrubar rotas HTTP. */
  private readonly optional: boolean;
  private degraded = false;
  private readonly mem = new Map<string, MemEntry>();

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly chaosGate?: ChaosGateService,
  ) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = Number(this.configService.get<string>('REDIS_PORT', '6379'));
    const explicit = this.configService.get<string>('REDIS_OPTIONAL');
    this.optional =
      explicit === '1' ||
      (explicit !== '0' &&
        (this.configService.get<string>('NODE_ENV') ?? 'development') !== 'production');
    /** Sem fila offline: comandos falham cedo se não houver conexão (evita login pendurado em `incr`). */
    this.client = new Redis({
      host,
      port,
      maxRetriesPerRequest: 2,
      connectTimeout: 5_000,
      enableOfflineQueue: false,
      lazyConnect: this.optional,
    });
    if (this.optional) {
      this.client.on('error', () => {
        this.degraded = true;
      });
    }
  }

  private useMem(): boolean {
    return this.optional && this.degraded;
  }

  private memPrune(key: string, entry: MemEntry): MemEntry | null {
    if (entry.kind === 'string' && entry.expiresAt != null && entry.expiresAt <= Date.now()) {
      this.mem.delete(key);
      return null;
    }
    return entry;
  }

  private memGetString(key: string): string | null {
    const raw = this.mem.get(key);
    if (!raw) return null;
    const entry = this.memPrune(key, raw);
    if (!entry || entry.kind !== 'string') return null;
    return entry.value;
  }

  private memSetString(key: string, value: string, ttlSec?: number): void {
    this.mem.set(key, {
      kind: 'string',
      value,
      expiresAt: ttlSec != null && ttlSec > 0 ? Date.now() + ttlSec * 1000 : undefined,
    });
  }

  private memList(key: string): string[] {
    const raw = this.mem.get(key);
    if (!raw || raw.kind !== 'list') return [];
    return raw.items;
  }

  private memSetList(key: string, items: string[]): void {
    this.mem.set(key, { kind: 'list', items: [...items] });
  }

  private memHash(key: string): Record<string, string> {
    const raw = this.mem.get(key);
    if (!raw || raw.kind !== 'hash') return {};
    return { ...raw.fields };
  }

  private memSetHash(key: string, fields: Record<string, string>): void {
    this.mem.set(key, { kind: 'hash', fields: { ...fields } });
  }

  private async withChaos<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.useMem()) return fallback();
    try {
      if (this.chaosGate) await this.chaosGate.applyRedisChaos();
      if (this.optional && this.client.status !== 'ready') {
        await this.client.connect().catch(() => {
          this.degraded = true;
        });
      }
      if (this.useMem()) return fallback();
      return await fn();
    } catch (e) {
      if (this.optional) {
        this.degraded = true;
        this.logger.warn(`redis mem fallback (${(e as Error).message})`);
        return fallback();
      }
      throw e;
    }
  }

  async incr(key: string): Promise<number> {
    return this.withChaos(
      () => this.client.incr(key),
      () => {
        const cur = Number(this.memGetString(key) ?? '0') || 0;
        const next = cur + 1;
        this.memSetString(key, String(next));
        return next;
      },
    );
  }

  async decr(key: string): Promise<number> {
    return this.withChaos(
      () => this.client.decr(key),
      () => {
        const cur = Number(this.memGetString(key) ?? '0') || 0;
        const next = cur - 1;
        this.memSetString(key, String(next));
        return next;
      },
    );
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.withChaos(
      () => this.client.expire(key, seconds),
      () => {
        const raw = this.mem.get(key);
        if (!raw) return 0;
        if (raw.kind === 'string') {
          raw.expiresAt = Date.now() + seconds * 1000;
          return 1;
        }
        return 0;
      },
    );
  }

  async get(key: string): Promise<string | null> {
    return this.withChaos(() => this.client.get(key), () => this.memGetString(key));
  }

  async del(key: string): Promise<number> {
    return this.withChaos(
      () => this.client.del(key),
      () => (this.mem.delete(key) ? 1 : 0),
    );
  }

  /** Sem TTL — estado persistente (ex.: circuit breaker). */
  async setPersist(key: string, value: string): Promise<void> {
    await this.withChaos(
      async () => {
        await this.client.set(key, value);
        return null;
      },
      () => {
        this.memSetString(key, value);
        return null;
      },
    );
  }

  /** Define valor com TTL em segundos (para cache IBGE etc.). */
  async setex(key: string, seconds: number, value: string): Promise<void> {
    await this.withChaos(
      async () => {
        await this.client.set(key, value, 'EX', seconds);
        return null;
      },
      () => {
        this.memSetString(key, value, seconds);
        return null;
      },
    );
  }

  /** SET NX EX — retorna true se a chave foi criada. */
  async setNxEx(key: string, seconds: number, value: string): Promise<boolean> {
    return this.withChaos(
      async () => {
        const r = await this.client.set(key, value, 'EX', seconds, 'NX');
        return r === 'OK';
      },
      () => {
        if (this.memGetString(key) != null) return false;
        this.memSetString(key, value, seconds);
        return true;
      },
    );
  }

  /** Ping para healthcheck (retorna PONG se conectado). */
  async ping(): Promise<string> {
    return this.withChaos(() => this.client.ping(), () => 'PONG');
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    return this.withChaos(
      () => this.client.rpush(key, ...values),
      () => {
        const items = this.memList(key);
        items.push(...values);
        this.memSetList(key, items);
        return items.length;
      },
    );
  }

  async lpop(key: string): Promise<string | null> {
    return this.withChaos(
      () => this.client.lpop(key),
      () => {
        const items = this.memList(key);
        const v = items.shift() ?? null;
        this.memSetList(key, items);
        return v;
      },
    );
  }

  async llen(key: string): Promise<number> {
    return this.withChaos(
      () => this.client.llen(key),
      () => this.memList(key).length,
    );
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.withChaos(
      () => this.client.lrange(key, start, stop),
      () => {
        const items = this.memList(key);
        const end = stop < 0 ? items.length + stop + 1 : stop + 1;
        return items.slice(start, end);
      },
    );
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    return this.withChaos(
      () => this.client.lrem(key, count, value),
      () => {
        const items = this.memList(key);
        let removed = 0;
        const next: string[] = [];
        for (const item of items) {
          if (item === value && (count === 0 || removed < Math.abs(count))) {
            removed += 1;
            continue;
          }
          next.push(item);
        }
        this.memSetList(key, next);
        return removed;
      },
    );
  }

  async incrby(key: string, increment: number): Promise<number> {
    return this.withChaos(
      () => this.client.incrby(key, increment),
      () => {
        const cur = Number(this.memGetString(key) ?? '0') || 0;
        const next = cur + increment;
        this.memSetString(key, String(next));
        return next;
      },
    );
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.withChaos(
      () => this.client.lpush(key, ...values),
      () => {
        const items = this.memList(key);
        items.unshift(...values);
        this.memSetList(key, items);
        return items.length;
      },
    );
  }

  async ltrim(key: string, start: number, stop: number): Promise<'OK'> {
    return this.withChaos(
      () => this.client.ltrim(key, start, stop),
      () => {
        const items = this.memList(key);
        const end = stop < 0 ? items.length + stop + 1 : stop + 1;
        this.memSetList(key, items.slice(start, end));
        return 'OK';
      },
    );
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return this.withChaos(
      () => this.client.hincrby(key, field, increment),
      () => {
        const fields = this.memHash(key);
        const cur = Number(fields[field] ?? '0') || 0;
        const next = cur + increment;
        fields[field] = String(next);
        this.memSetHash(key, fields);
        return next;
      },
    );
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.withChaos(
      () => this.client.hgetall(key),
      () => this.memHash(key),
    );
  }

  async zincrby(key: string, increment: number, member: string): Promise<string> {
    return this.withChaos(
      () => this.client.zincrby(key, increment, member),
      () => '0',
    );
  }

  /** Maiores scores primeiro (para ranking de rotas/usuários). */
  async zrevrangeWithScores(
    key: string,
    start: number,
    stop: number,
  ): Promise<Array<{ member: string; score: number }>> {
    return this.withChaos(
      async () => {
        const raw = await this.client.zrevrange(key, start, stop, 'WITHSCORES');
        const out: Array<{ member: string; score: number }> = [];
        for (let i = 0; i < raw.length; i += 2) {
          const member = raw[i];
          const score = Number(raw[i + 1]);
          if (member !== undefined && Number.isFinite(score)) {
            out.push({ member, score });
          }
        }
        return out;
      },
      () => [],
    );
  }

  /** SCAN para listar chaves (ex.: `sess:*:*`). */
  async scanMatch(pattern: string): Promise<string[]> {
    return this.withChaos(
      async () => {
        const keys: string[] = [];
        let cursor = '0';
        do {
          const [next, batch] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 400);
          cursor = next;
          keys.push(...batch);
        } while (cursor !== '0');
        return keys;
      },
      () => {
        const re = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
        return [...this.mem.keys()].filter((k) => re.test(k));
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      /* */
    }
  }
}
