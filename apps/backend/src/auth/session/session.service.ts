import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DEFAULT_TENANT_ID } from '../../tenant/tenant.constants';
import { TenantConfigService } from '../../tenant/tenant-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { parseUserAgentParts, deviceLabelFromChannel } from './user-agent.parse';
import type {
  AuthChannel,
  SessionRedisPayload,
  PessoaAutorizadaSessionPayload,
  PermissoesPessoaSessionPayload,
} from './session.types';

export type ActiveSessionEnrichedDto = {
  sessionId: string;
  fingerprint: string;
  ip: string;
  geo: { cidade: string | null; estado: string | null; pais: string | null };
  userAgent: { navegador: string; so: string; device: string };
  inicioSessao: string;
  ultimoAcesso: string;
};

export type DeviceAuditRowDto = {
  id: string;
  fingerprint: string;
  ip: string;
  geo: { cidade: string | null; estado: string | null; pais: string | null };
  userAgent: { navegador: string; so: string; device: string };
  rota: string;
  metodo: string;
  deviceType: string | null;
  timestamp: string;
};

function parseGeolocJson(raw: string | null | undefined): {
  cidade: string | null;
  estado: string | null;
  pais: string | null;
} {
  if (!raw?.trim()) return { cidade: null, estado: null, pais: null };
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    if (j?.scope === 'private') return { cidade: null, estado: null, pais: null };
    return {
      cidade: typeof j.city === 'string' ? j.city : null,
      estado: typeof j.region === 'string' ? j.region : null,
      pais: typeof j.country === 'string' ? j.country : null,
    };
  } catch {
    return { cidade: null, estado: null, pais: null };
  }
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  private maxSessions(tenantId = DEFAULT_TENANT_ID): number {
    return this.tenantConfig.getParametrosSegurancaSync(tenantId).sessoesMaximasConcorrentes;
  }

  private keySession(userId: string, sessionId: string): string {
    return `sess:${userId}:${sessionId}`;
  }

  private keyList(userId: string): string {
    return `sess-list:${userId}`;
  }

  private keyCount(userId: string): string {
    return `sess-count:${userId}`;
  }

  async registerSession(
    userId: string,
    data: Omit<SessionRedisPayload, 'createdAt' | 'lastSeenAt'>,
    ttlSeconds: number,
    tenantId = DEFAULT_TENANT_ID,
  ): Promise<{ sessionId: string }> {
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const payload: SessionRedisPayload = {
      ...data,
      createdAt: now,
      lastSeenAt: now,
    };
    const listKey = this.keyList(userId);
    const sessKey = this.keySession(userId, sessionId);

    try {
      while ((await this.redis.llen(listKey)) >= this.maxSessions(tenantId)) {
        const victim = await this.redis.lpop(listKey);
        if (victim) {
          await this.redis.del(this.keySession(userId, victim));
        } else break;
      }

      await this.redis.rpush(listKey, sessionId);
      await this.redis.setex(sessKey, ttlSeconds, JSON.stringify(payload));
      const total = await this.redis.llen(listKey);
      await this.redis.setex(this.keyCount(userId), ttlSeconds, String(total));
    } catch (e) {
      this.logger.warn(`Redis sessão não registrada: ${(e as Error).message}`);
      throw e;
    }

    return { sessionId };
  }

  async getSession(userId: string, sessionId: string): Promise<SessionRedisPayload | null> {
    const raw = await this.redis.get(this.keySession(userId, sessionId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionRedisPayload;
    } catch {
      return null;
    }
  }

  async touchSession(userId: string, sessionId: string, ttlSeconds: number): Promise<boolean> {
    const cur = await this.getSession(userId, sessionId);
    if (!cur) return false;
    cur.lastSeenAt = new Date().toISOString();
    await this.redis.setex(this.keySession(userId, sessionId), ttlSeconds, JSON.stringify(cur));
    return true;
  }

  async setPessoaAutorizada(
    userId: string,
    sessionId: string,
    pessoa: PessoaAutorizadaSessionPayload,
    ttlSeconds: number,
    permissoes?: PermissoesPessoaSessionPayload,
  ): Promise<boolean> {
    const cur = await this.getSession(userId, sessionId);
    if (!cur) return false;
    cur.pessoaAutorizada = pessoa;
    if (permissoes) cur.permissoesPessoa = permissoes;
    cur.lastSeenAt = new Date().toISOString();
    await this.redis.setex(this.keySession(userId, sessionId), ttlSeconds, JSON.stringify(cur));
    return true;
  }

  async setPermissoesPessoa(
    userId: string,
    sessionId: string,
    permissoes: PermissoesPessoaSessionPayload,
    ttlSeconds: number,
  ): Promise<boolean> {
    const cur = await this.getSession(userId, sessionId);
    if (!cur) return false;
    cur.permissoesPessoa = permissoes;
    cur.lastSeenAt = new Date().toISOString();
    await this.redis.setex(this.keySession(userId, sessionId), ttlSeconds, JSON.stringify(cur));
    return true;
  }

  async clearPessoaAutorizada(userId: string, sessionId: string, ttlSeconds: number): Promise<boolean> {
    const cur = await this.getSession(userId, sessionId);
    if (!cur) return false;
    delete cur.pessoaAutorizada;
    delete cur.permissoesPessoa;
    cur.lastSeenAt = new Date().toISOString();
    await this.redis.setex(this.keySession(userId, sessionId), ttlSeconds, JSON.stringify(cur));
    return true;
  }

  async assertSessionValid(
    userId: string,
    sessionId: string,
    fingerprint: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const s = await this.getSession(userId, sessionId);
    if (!s) return false;
    if (s.fingerprint !== fingerprint) return false;
    if (await this.isFingerprintBlocked(s.fingerprint)) return false;
    await this.touchSession(userId, sessionId, ttlSeconds);
    return true;
  }

  /** Bloqueio administrativo (`POST /admin/security/bloquear-dispositivo`). */
  async isFingerprintBlocked(fingerprint: string): Promise<boolean> {
    const v = await this.redis.get(`sec:block-fp:${fingerprint}`);
    return !!v?.trim();
  }

  async removeSession(userId: string, sessionId: string, ttlHintSec = 604_800): Promise<void> {
    const listKey = this.keyList(userId);
    await this.redis.lrem(listKey, 1, sessionId);
    await this.redis.del(this.keySession(userId, sessionId));
    const total = await this.redis.llen(listKey);
    if (total === 0) {
      await this.redis.del(this.keyCount(userId));
    } else {
      await this.redis.setex(this.keyCount(userId), ttlHintSec, String(total));
    }
  }

  async listSessions(userId: string): Promise<
    Array<{ sessionId: string } & SessionRedisPayload>
  > {
    const ids = await this.redis.lrange(this.keyList(userId), 0, -1);
    const out: Array<{ sessionId: string } & SessionRedisPayload> = [];
    for (const id of ids) {
      const data = await this.getSession(userId, id);
      if (data) out.push({ sessionId: id, ...data });
    }
    return out;
  }

  /** Lista enriquecida para painel de dispositivos (geo + UA). */
  async getActiveSessions(userId: string): Promise<ActiveSessionEnrichedDto[]> {
    const sessions = await this.listSessions(userId);
    if (!sessions.length) return [];

    const uniqFp = [...new Set(sessions.map((s) => s.fingerprint))];
    const auditRows = await Promise.all(
      uniqFp.map((fp) =>
        this.prisma.deviceAuditoria.findFirst({
          where: { userId, fingerprint: fp },
          orderBy: { timestamp: 'desc' },
        }),
      ),
    );
    const latestByFp = new Map<string, (typeof auditRows)[0]>();
    for (const a of auditRows) {
      if (a) latestByFp.set(a.fingerprint, a);
    }

    return sessions.map((row) => {
      const audit = latestByFp.get(row.fingerprint);
      const geoRaw = audit?.geoloc ?? null;
      const geo = parseGeolocJson(geoRaw);
      const uaSrc = audit?.userAgent?.trim() ? audit.userAgent : row.userAgent;
      const parsed = parseUserAgentParts(uaSrc);
      const deviceLabel = deviceLabelFromChannel(parsed.device, row.channel as AuthChannel);
      return {
        sessionId: row.sessionId,
        fingerprint: row.fingerprint,
        ip: row.ip,
        geo,
        userAgent: {
          navegador: parsed.navegador,
          so: parsed.so,
          device: deviceLabel,
        },
        inicioSessao: row.createdAt,
        ultimoAcesso: row.lastSeenAt,
      };
    });
  }

  /** Histórico recente na tabela `device_auditorias`. */
  async getDeviceAudit(userId: string, take = 100): Promise<DeviceAuditRowDto[]> {
    const rows = await this.prisma.deviceAuditoria.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take,
    });
    return rows.map((r) => {
      const parsed = parseUserAgentParts(r.userAgent);
      return {
        id: r.id,
        fingerprint: r.fingerprint,
        ip: r.ip,
        geo: parseGeolocJson(r.geoloc),
        userAgent: {
          navegador: parsed.navegador,
          so: parsed.so,
          device: deviceLabelFromChannel(parsed.device),
        },
        rota: r.rota,
        metodo: r.metodo,
        deviceType: r.deviceType,
        timestamp: r.timestamp.toISOString(),
      };
    });
  }

  /** Encerra sessão somente se pertencer ao usuário (painel portal/staff). */
  async assertSessionOwnedAndRemove(
    userId: string,
    sessionId: string,
    ttlHintSec: number,
  ): Promise<void> {
    const sessions = await this.listSessions(userId);
    if (!sessions.some((s) => s.sessionId === sessionId)) {
      throw new UnauthorizedException('Sessão não encontrada para este usuário');
    }
    await this.removeSession(userId, sessionId, ttlHintSec);
  }
}
