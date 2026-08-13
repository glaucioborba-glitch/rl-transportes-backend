import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { DeviceService } from '../auth/session/device.service';
import { SessionService } from '../auth/session/session.service';
import { parseDurationToSeconds } from '../auth/session/session.util';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SecurityAnalyticsService } from './security-analytics.service';
import { SecurityEventsService } from './security-events.service';
import { IntrusionService } from '../security-engine/intrusion.service';
import { probeSecurityEngineStatus } from '../health/security-engine-probe.util';

const ALERT_TIPOS = ['CRÍTICO', 'ALTO', 'MODERADO', 'LEVE'] as const;

const RISK_PROFILE_CACHE_TTL_SEC = 5;
const RISK_PROFILE_RATE_PER_SEC = 5;

export type PortalRiskProfilePayload = {
  riscoGlobal: number | null;
  ultimasAnomalias: unknown[];
  fingerprintAtual: string;
  fingerprintSelo: 'confiavel' | 'novo' | 'suspeito';
  riscoPorDispositivo: Array<{ sessionId: string; fingerprint: string; score: number }>;
  recomendacao: string;
  status?: string;
  motivo?: string;
  risco?: string;
};

@Injectable()
export class PortalSecurityService {
  private readonly logger = new Logger(PortalSecurityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly analytics: SecurityAnalyticsService,
    private readonly events: SecurityEventsService,
    private readonly device: DeviceService,
    private readonly config: ConfigService,
    private readonly intrusion: IntrusionService,
    private readonly redis: RedisService,
  ) {}

  private unableProfile(
    motivo: string,
    extra?: Partial<PortalRiskProfilePayload>,
  ): PortalRiskProfilePayload {
    return {
      riscoGlobal: 0,
      status: 'unable-to-evaluate',
      motivo,
      risco: 'indisponivel',
      ultimasAnomalias: [],
      fingerprintAtual: '',
      fingerprintSelo: 'novo',
      riscoPorDispositivo: [],
      recomendacao: '',
      ...extra,
    };
  }

  /** Redis/engine indisponível — contrato estável para o portal (sem 5xx / sem 429). */
  private securityEngineUnavailable(): PortalRiskProfilePayload {
    return {
      riscoGlobal: null,
      status: 'unavailable',
      motivo: 'security-engine-offline',
      risco: 'indisponivel',
      ultimasAnomalias: [],
      fingerprintAtual: '',
      fingerprintSelo: 'novo',
      riscoPorDispositivo: [],
      recomendacao: '',
    };
  }

  private throttledUnavailable(): PortalRiskProfilePayload {
    return {
      riscoGlobal: null,
      status: 'unavailable',
      motivo: 'rate-throttled',
      risco: 'indisponivel',
      ultimasAnomalias: [],
      fingerprintAtual: '',
      fingerprintSelo: 'novo',
      riscoPorDispositivo: [],
      recomendacao: '',
    };
  }

  private sessionHeader(req: Request): string {
    const raw = req.headers['x-session-id'];
    const s = Array.isArray(raw) ? raw[0] : raw;
    return typeof s === 'string' ? s.trim() : '';
  }

  /** Headers exigidos pelo Security Engine / middleware do portal. */
  private headersComplete(req: Request): boolean {
    const hdr = this.device.extractHeaders(req);
    const sid = this.sessionHeader(req);
    return Boolean(
      hdr.deviceScreen?.trim() &&
        hdr.deviceOs?.trim() &&
        hdr.deviceBrowser?.trim() &&
        hdr.deviceTimezone?.trim() &&
        hdr.clientFingerprint?.trim() &&
        sid,
    );
  }

  private normalizeIp(req: Request): string {
    return String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '').trim() || 'unknown';
  }

  /**
   * Perfil de risco para banner / página segurança.
   * Sempre retorna 200 no controller; aqui nunca lança — fallback antifraude/retry storm.
   * Cache Redis 5s + rate limit 5 req/s por IP.
   */
  async getRiskProfile(
    userId: string,
    clienteId: string | null,
    sidAtual: string | undefined,
    req: Request,
  ): Promise<PortalRiskProfilePayload> {
    if (!this.headersComplete(req)) {
      return this.unableProfile('headers-incompletos');
    }

    try {
      const engine = await probeSecurityEngineStatus(this.redis, this.prisma);
      if (engine === 'offline') {
        return this.securityEngineUnavailable();
      }
    } catch {
      return this.securityEngineUnavailable();
    }

    const ip = this.normalizeIp(req);
    const cacheKey = `portal:riskprof:cache:${userId}`;
    const sec = Math.floor(Date.now() / 1000);
    const rlKey = `portal:riskprof:rl:${ip}:${sec}`;

    try {
      const cachedHit = await this.redis.get(cacheKey);
      if (cachedHit) {
        try {
          return JSON.parse(cachedHit) as PortalRiskProfilePayload;
        } catch {
          /* */
        }
      }

      const n = await this.redis.incr(rlKey);
      if (n === 1) await this.redis.expire(rlKey, 3);
      if (n > RISK_PROFILE_RATE_PER_SEC) {
        const stale = await this.redis.get(cacheKey);
        if (stale) {
          try {
            return JSON.parse(stale) as PortalRiskProfilePayload;
          } catch {
            /* */
          }
        }
        return this.throttledUnavailable();
      }
    } catch (e) {
      this.logger.warn(`risk-profile redis: ${(e as Error).message}`);
    }

    try {
      const body = await this.computeRiskProfile(userId, clienteId, sidAtual, req);
      try {
        await this.redis.setex(cacheKey, RISK_PROFILE_CACHE_TTL_SEC, JSON.stringify(body));
      } catch {
        /* */
      }
      return body;
    } catch (e) {
      this.logger.warn(`getRiskProfile: ${(e as Error).message}`);
      return this.unableProfile('erro-interno');
    }
  }

  /**
   * Cálculo pesado — apenas chamado com headers válidos e dentro do rate limit.
   */
  private async computeRiskProfile(
    userId: string,
    clienteId: string | null,
    sidAtual: string | undefined,
    req: Request,
  ): Promise<PortalRiskProfilePayload> {
    const ip = String(req.ip || req.socket?.remoteAddress || '');
    const ua = req.get('user-agent') || '';
    const hdr = this.device.extractHeaders(req);
    const fingerprintAtual = this.device.computeFingerprint(ip, ua, hdr);

    const list = await this.sessions.listSessions(userId);
    const riscoPorDispositivo: Array<{ sessionId: string; fingerprint: string; score: number }> =
      [];
    let riscoGlobal = 0;

    const portalTtl = parseDurationToSeconds(
      this.config.get<string>('PORTAL_JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );

    for (const row of list) {
      const score = await this.analytics.computeRiskScore(userId, row.sessionId);
      await this.intrusion.recordSessionRiskScore({
        userId,
        clienteId,
        sessionId: row.sessionId,
        score,
        fingerprint: row.fingerprint,
        ip,
        rota: req.url || '',
      });

      riscoPorDispositivo.push({
        sessionId: row.sessionId,
        fingerprint: row.fingerprint,
        score,
      });
      riscoGlobal = Math.max(riscoGlobal, score);

      if (score >= 90 && sidAtual && row.sessionId !== sidAtual) {
        try {
          await this.sessions.removeSession(userId, row.sessionId, portalTtl);
          this.events.emit({
            type: 'RISK_UPDATE',
            userId,
            clienteId,
            score,
            sessionId: row.sessionId,
          });
        } catch (e) {
          this.logger.warn(`Expulsar sessão de alto risco: ${(e as Error).message}`);
        }
      }
    }

    const ultimasAnomalias = await this.prisma.securityAlert.findMany({
      where: {
        userId,
        tipo: { in: ['CRÍTICO', 'ALTO'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    let recomendacao = 'Nenhuma ação urgente.';
    if (riscoGlobal >= 80) {
      recomendacao =
        'Revise os dispositivos conectados e encerre sessões que você não reconhece imediatamente.';
    } else if (riscoGlobal >= 60) {
      recomendacao = 'Monitore o painel de segurança e mantenha apenas dispositivos confiáveis ativos.';
    }

    if (riscoGlobal >= 75) {
      await this.maybePersistAlert(userId, clienteId, riscoGlobal, fingerprintAtual, ip, req.url || '');
    }

    const sessaoAtual = sidAtual ? list.find((s) => s.sessionId === sidAtual) : undefined;
    const fingerprintSelo: 'confiavel' | 'novo' | 'suspeito' = !sessaoAtual
      ? 'novo'
      : sessaoAtual.fingerprint === fingerprintAtual
        ? 'confiavel'
        : 'suspeito';

    return {
      riscoGlobal,
      ultimasAnomalias,
      fingerprintAtual,
      fingerprintSelo,
      riscoPorDispositivo,
      recomendacao,
    };
  }

  private async maybePersistAlert(
    userId: string,
    clienteId: string | null,
    score: number,
    fingerprint: string,
    ip: string,
    rota: string,
  ): Promise<void> {
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const recent = await this.prisma.securityAlert.count({
      where: { userId, createdAt: { gte: since } },
    });
    if (recent >= 8) return;

    const tipo =
      score >= 85 ? 'CRÍTICO' : score >= 70 ? 'ALTO' : score >= 60 ? 'MODERADO' : 'LEVE';
    if (!ALERT_TIPOS.includes(tipo as (typeof ALERT_TIPOS)[number])) return;

    try {
      const row = await this.prisma.securityAlert.create({
        data: {
          userId,
          clienteId,
          tipo,
          risco: score,
          ip: ip.slice(0, 64),
          fingerprint: fingerprint.slice(0, 128),
          rota: rota.slice(0, 500),
          metodo: 'EVAL',
          contexto: { origem: 'portal_risk_profile' },
        },
      });
      if (tipo === 'CRÍTICO') {
        this.events.emit({
          type: 'CRITICAL_EVENT',
          alertId: row.id,
          userId,
          tipo,
        });
      }
    } catch (e) {
      this.logger.warn(`security_alerts: ${(e as Error).message}`);
    }
  }

  async listIntrusoesCliente(clienteId: string) {
    return this.prisma.securityAlert.findMany({
      where: {
        clienteId,
        tipo: { in: ['CRÍTICO', 'ALTO'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async revokeAllSessionsExcept(userId: string, keepSessionId?: string): Promise<number> {
    const ttl = parseDurationToSeconds(
      this.config.get<string>('PORTAL_JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
    const list = await this.sessions.listSessions(userId);
    let n = 0;
    for (const row of list) {
      if (keepSessionId && row.sessionId === keepSessionId) continue;
      await this.sessions.removeSession(userId, row.sessionId, ttl);
      n++;
    }
    return n;
  }

  /** Últimas coordenadas de auditoria de dispositivo para usuários do cliente (mapa mini). */
  async getUltimasCoordsCliente(clienteId: string): Promise<Array<{ lat: number; lon: number }>> {
    const users = await this.prisma.user.findMany({
      where: { clienteId },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (!ids.length) return [];
    const rows = await this.prisma.deviceAuditoria.findMany({
      where: { userId: { in: ids }, geoloc: { not: null } },
      orderBy: { timestamp: 'desc' },
      take: 50,
      select: { geoloc: true },
    });
    const out: Array<{ lat: number; lon: number }> = [];
    for (const r of rows) {
      try {
        const j = JSON.parse(r.geoloc || '{}') as Record<string, unknown>;
        const lat = typeof j.lat === 'number' ? j.lat : Number(j.lat);
        const lon = typeof j.lon === 'number' ? j.lon : Number(j.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) out.push({ lat, lon });
      } catch {
        /* */
      }
    }
    return out;
  }
}
