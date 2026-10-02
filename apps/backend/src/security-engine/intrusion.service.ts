import { Injectable, Logger } from '@nestjs/common';
import { RiskRulesService } from './risk-rules.service';
import { AnomalyMlService } from './anomaly-ml.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SecurityEventsService } from '../security-center/security-events.service';
import type { SecurityRequestContext } from '../common/types/security-request-context';

const ALERT_TIPOS = ['CRÍTICO', 'ALTO', 'MODERADO', 'LEVE'] as const;

/** Sinais normalizados vindos do middleware global de headers de segurança. */
export type SecurityHeaderSignals = {
  ip: string;
  fingerprint: string;
  sessionId: string;
  os: string;
  browser: string;
  screen: string;
  timezone: string;
  userAgent: string;
};

/**
 * Motor de intrusão — correlaciona sinais, persiste `security_alerts`, Redis e eventos.
 */
@Injectable()
export class IntrusionService {
  private readonly logger = new Logger(IntrusionService.name);

  constructor(
    private readonly rules: RiskRulesService,
    private readonly ml: AnomalyMlService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly events: SecurityEventsService,
  ) {}

  ruleThresholds(): { km: number; min: number } {
    return { km: this.rules.impossibleTravelKm, min: this.rules.impossibleTravelMin };
  }

  dummyBehaviorScore(): number {
    return this.ml.scoreFromFeatures({});
  }

  /**
   * Após cada avaliação de risco por sessão: Redis `sessionRiskScore:{id}`, WS e opcional alerta CRÍTICO.
   */
  async recordSessionRiskScore(params: {
    userId: string;
    clienteId?: string | null;
    sessionId: string;
    score: number;
    fingerprint?: string;
    ip?: string;
    rota?: string;
  }): Promise<void> {
    const ttl = 3600;
    try {
      await this.redis.setex(`sessionRiskScore:${params.sessionId}`, ttl, String(params.score));
    } catch (e) {
      this.logger.warn(`sessionRiskScore redis: ${(e as Error).message}`);
    }

    this.events.emit({
      type: 'RISK_UPDATE',
      userId: params.userId,
      clienteId: params.clienteId ?? null,
      score: params.score,
      sessionId: params.sessionId,
    });

    this.events.emitRiskChanged({
      kind: 'security.risk-changed',
      userId: params.userId,
      clienteId: params.clienteId ?? null,
      sessionId: params.sessionId,
      score: params.score,
    });

    if (params.score >= 85 && params.fingerprint && params.ip !== undefined) {
      await this.maybePersistSevereAlert({
        userId: params.userId,
        clienteId: params.clienteId,
        score: params.score,
        fingerprint: params.fingerprint,
        ip: params.ip,
        rota: params.rota,
      });
    }
  }

  private async maybePersistSevereAlert(params: {
    userId: string;
    clienteId?: string | null;
    score: number;
    fingerprint: string;
    ip: string;
    rota?: string;
  }): Promise<void> {
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const recent = await this.prisma.securityAlert.count({
      where: { userId: params.userId, createdAt: { gte: since } },
    });
    if (recent >= 8) return;

    const tipo = params.score >= 92 ? 'CRÍTICO' : 'ALTO';
    if (!ALERT_TIPOS.includes(tipo as (typeof ALERT_TIPOS)[number])) return;

    try {
      const row = await this.prisma.securityAlert.create({
        data: {
          userId: params.userId,
          clienteId: params.clienteId ?? null,
          tipo,
          risco: params.score,
          ip: params.ip.slice(0, 64),
          fingerprint: params.fingerprint.slice(0, 128),
          rota: (params.rota ?? '').slice(0, 500),
          metodo: 'EVAL',
          contexto: { origem: 'intrusion_session_score' },
        },
      });
      if (tipo === 'CRÍTICO') {
        this.events.emit({
          type: 'CRITICAL_EVENT',
          alertId: row.id,
          userId: params.userId,
          tipo,
        });
      }
    } catch (e) {
      this.logger.warn(`security_alerts: ${(e as Error).message}`);
    }
  }

  /**
   * IP com headers incompletos em modo não estrito (ex.: dev) — contagem para risco LEVE.
   */
  async trackMissingSecurityHeaders(ipRaw: string): Promise<void> {
    const ip = this.normalizeIp(ipRaw);
    const key = `sec:hdr:miss:${ip}`;
    try {
      const n = await this.redis.incr(key);
      if (n === 1) await this.redis.expire(key, 3600);
      if (n === 12 || n === 40) {
        await this.persistHeaderSignalAlert({
          tipo: 'HEADERS_INCOMPLETOS_LEVE',
          risco: 22,
          ip,
          fingerprint: null,
          contexto: { origem: 'security_headers', count: n },
          throttleKey: `sec:th:miss:${ip}:${Math.floor(n / 40)}`,
          throttleSec: 7200,
        });
      }
    } catch (e) {
      this.logger.warn(`trackMissingSecurityHeaders: ${(e as Error).message}`);
    }
  }

  /**
   * Correlaciona fingerprint/sessão, UA × resolução e timezone × geo (cache Redis `geo:ip:`).
   */
  async analyzeHeaders(signals: SecurityHeaderSignals): Promise<void> {
    const ip = this.normalizeIp(signals.ip);
    const sidShort = signals.sessionId.slice(0, 128);
    const fpKey = `sec:hdrfp:${sidShort}`;

    try {
      const prev = await this.redis.get(fpKey);
      if (prev && prev !== signals.fingerprint) {
        await this.persistHeaderSignalAlert({
          tipo: 'FINGERPRINT_SESSAO_DIVERGENTE',
          risco: 48,
          ip,
          fingerprint: signals.fingerprint,
          contexto: {
            origem: 'security_headers',
            motivo: 'fingerprint_drift',
            sessionIdPrefix: sidShort.slice(0, 16),
          },
          throttleKey: `sec:th:fpdrift:${sidShort}`,
          throttleSec: 1800,
        });
      }
      await this.redis.setex(fpKey, 86_400, signals.fingerprint);
    } catch (e) {
      this.logger.warn(`analyzeHeaders fp redis: ${(e as Error).message}`);
    }

    const ua = (signals.userAgent || '').toLowerCase();
    const dims = this.parseScreenDims(signals.screen);
    const mobileUa = /mobile|iphone|android.*mobile|iemobile/.test(ua);
    if (dims && dims.w >= 1400 && mobileUa) {
      await this.persistHeaderSignalAlert({
        tipo: 'SCREEN_UA_INCONSISTENTE',
        risco: 44,
        ip,
        fingerprint: signals.fingerprint,
        contexto: {
          origem: 'security_headers',
          motivo: 'large_screen_mobile_ua',
          screen: signals.screen,
        },
        throttleKey: `sec:th:scr:${sidShort}`,
        throttleSec: 3600,
      });
    }

    await this.evaluateTimezoneGeoMismatch(ip, signals.timezone, signals.fingerprint, sidShort);
  }

  /** Conveniência para o middleware global (`req.securityContext`). */
  async analyzeHeadersFromContext(
    ctx: SecurityRequestContext,
    ipRaw: string,
    userAgent: string,
  ): Promise<void> {
    await this.analyzeHeaders({
      ip: ipRaw,
      fingerprint: ctx.fingerprint,
      sessionId: ctx.sessionId,
      os: ctx.device.os,
      browser: ctx.device.browser,
      screen: ctx.device.screen,
      timezone: ctx.device.timezone,
      userAgent,
    });
  }

  /** Headers ausentes ou modo dev com semântica flexível — alerta leve (telemetria degradada). */
  async reportSecurityDegradedHeaders(ipRaw: string, reason: string): Promise<void> {
    const ip = this.normalizeIp(ipRaw);
    const detail = reason.slice(0, 200);
    await this.persistHeaderSignalAlert({
      tipo: 'SEGURANCA_DEGRADADA_HEADERS',
      risco: 18,
      ip,
      fingerprint: null,
      contexto: {
        origem: 'security_headers',
        motivo: 'security-degraded',
        detail,
      },
      throttleKey: `sec:th:sdeg:${ip}:${detail.slice(0, 48)}`,
      throttleSec: 7200,
    });
  }

  private normalizeIp(ipRaw: string): string {
    return ipRaw.replace(/^::ffff:/, '').trim().slice(0, 64) || 'unknown';
  }

  private parseScreenDims(screen: string): { w: number; h: number } | null {
    const m = /^(\d+)\s*x\s*(\d+)/i.exec((screen || '').trim());
    if (!m) return null;
    const w = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
    return { w, h };
  }

  private async evaluateTimezoneGeoMismatch(
    ip: string,
    timezone: string,
    fingerprint: string,
    sidShort: string,
  ): Promise<void> {
    const tz = (timezone || '').toLowerCase();
    if (!tz || ip === '127.0.0.1' || ip === '::1' || ip === 'unknown') return;

    let geoRaw: string | null = null;
    try {
      geoRaw = await this.redis.get(`geo:ip:${ip}`);
    } catch {
      geoRaw = null;
    }
    if (!geoRaw) return;

    try {
      const j = JSON.parse(geoRaw) as { country?: string; scope?: string };
      if (j.scope === 'private') return;
      if (j.country !== 'Brazil') return;

      const looksAmericaBr =
        tz.startsWith('america/') ||
        tz.includes('sao_paulo') ||
        tz.includes('belem') ||
        tz.includes('fortaleza') ||
        tz.includes('recife') ||
        tz.includes('manaus') ||
        tz.includes('campo_grande') ||
        tz.includes('cuiaba');

      if (!looksAmericaBr && tz !== 'utc' && tz !== 'etc/utc') {
        await this.persistHeaderSignalAlert({
          tipo: 'TIMEZONE_GEO_INCOMPATIVEL',
          risco: 72,
          ip,
          fingerprint,
          contexto: {
            origem: 'security_headers',
            motivo: 'tz_vs_geo_br',
            timezone: tz,
            country: j.country,
          },
          throttleKey: `sec:th:tz:${sidShort}`,
          throttleSec: 7200,
        });
      }
    } catch {
      /* ignore JSON */
    }
  }

  private async persistHeaderSignalAlert(params: {
    tipo: string;
    risco: number;
    ip: string;
    fingerprint: string | null;
    contexto: Record<string, unknown>;
    throttleKey: string;
    throttleSec: number;
  }): Promise<void> {
    try {
      const exists = await this.redis.get(params.throttleKey);
      if (exists) return;
      await this.redis.setex(params.throttleKey, params.throttleSec, '1');
    } catch (e) {
      this.logger.warn(`persistHeaderSignal throttle: ${(e as Error).message}`);
      return;
    }

    try {
      await this.prisma.securityAlert.create({
        data: {
          userId: null,
          clienteId: null,
          tipo: params.tipo.slice(0, 96),
          risco: params.risco,
          ip: params.ip.slice(0, 64),
          fingerprint: params.fingerprint?.slice(0, 128) ?? null,
          rota: null,
          metodo: 'HEADERS',
          contexto: params.contexto as object,
        },
      });
    } catch (e) {
      this.logger.warn(`security_alerts header signals: ${(e as Error).message}`);
    }
  }
}
