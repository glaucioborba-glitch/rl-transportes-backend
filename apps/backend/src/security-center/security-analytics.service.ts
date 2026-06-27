import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SessionService } from '../auth/session/session.service';

const FP_BLOCK = 'sec:block-fp:';

export type HeatmapPoint = { lat: number; lon: number; peso: number };

@Injectable()
export class SecurityAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sessions: SessionService,
  ) {}

  fingerprintBlockKey(fp: string): string {
    return `${FP_BLOCK}${fp}`;
  }

  async isFingerprintBlocked(fp: string): Promise<boolean> {
    const v = await this.redis.get(this.fingerprintBlockKey(fp));
    return !!v?.trim();
  }

  async computeRiskScore(userId: string, sessionId: string): Promise<number> {
    const row = await this.sessions.getSession(userId, sessionId);
    if (!row) return 100;
    let score = 10;
    const recentFails = await this.prisma.loginAttempt.count({
      where: {
        userId,
        sucesso: false,
        createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      },
    });
    score += Math.min(40, recentFails * 5);
    const audits = await this.prisma.deviceAuditoria.count({
      where: {
        userId,
        fingerprint: row.fingerprint,
        timestamp: { gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) },
      },
    });
    if (audits < 3) score += 15;
    return Math.min(100, score);
  }

  async getGlobalSecurityMetrics(): Promise<{
    sessoesRedisApprox: number;
    alertas24h: number;
    loginsFalha24h: number;
    tentativasLogin24h: number;
  }> {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [sessKeys, alertas, falhas, total] = await Promise.all([
      this.redis.scanMatch('sess:*:*'),
      this.prisma.securityAlert.count({ where: { createdAt: { gte: since } } }),
      this.prisma.loginAttempt.count({
        where: { sucesso: false, createdAt: { gte: since } },
      }),
      this.prisma.loginAttempt.count({
        where: { createdAt: { gte: since } },
      }),
    ]);
    return {
      sessoesRedisApprox: sessKeys.length,
      alertas24h: alertas,
      loginsFalha24h: falhas,
      tentativasLogin24h: total,
    };
  }

  async heatmapFromAudits(limit = 800): Promise<HeatmapPoint[]> {
    const rows = await this.prisma.deviceAuditoria.findMany({
      where: { geoloc: { not: null } },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: { geoloc: true },
    });
    const out: HeatmapPoint[] = [];
    for (const r of rows) {
      try {
        const j = JSON.parse(r.geoloc || '{}') as Record<string, unknown>;
        const lat = typeof j.lat === 'number' ? j.lat : Number(j.lat);
        const lon = typeof j.lon === 'number' ? j.lon : Number(j.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          out.push({ lat, lon, peso: 1 });
        }
      } catch {
        /* */
      }
    }
    return out;
  }

  async listStoredAlerts(take = 200) {
    return this.prisma.securityAlert.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /** Agrega pontos próximos em células para mapa de calor. */
  heatmapWithDensity(precision = 1): Promise<Array<{ lat: number; lon: number; densidade: number }>> {
    return this.heatmapFromAudits(1200).then((points) => {
      const m = new Map<string, { lat: number; lon: number; n: number }>();
      for (const p of points) {
        const key = `${p.lat.toFixed(precision)}|${p.lon.toFixed(precision)}`;
        const cur = m.get(key);
        if (cur) cur.n += p.peso;
        else m.set(key, { lat: p.lat, lon: p.lon, n: p.peso });
      }
      return [...m.values()].map((v) => ({ lat: v.lat, lon: v.lon, densidade: v.n }));
    });
  }

  async riskMatrix(): Promise<{
    topIps: Array<{ ip: string; count: number }>;
    fingerprintsBloqueados: number;
    usuariosMaisAlertas: Array<{ userId: string; count: number }>;
    rotasExploradas: Array<{ rota: string; count: number }>;
    porSeveridade: Record<string, number>;
    scoreAmbiente: number;
  }> {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const [logins, alerts, fpsBlockedRaw] = await Promise.all([
      this.prisma.loginAttempt.findMany({
        where: { createdAt: { gte: since }, ip: { not: null } },
        select: { ip: true },
      }),
      this.prisma.securityAlert.findMany({
        where: { createdAt: { gte: since } },
        select: { tipo: true, userId: true, rota: true },
      }),
      this.redis.scanMatch(`${FP_BLOCK}*`),
    ]);

    const ipCount = new Map<string, number>();
    for (const l of logins) {
      const ip = (l.ip || '').trim();
      if (!ip) continue;
      ipCount.set(ip, (ipCount.get(ip) ?? 0) + 1);
    }
    const topIps = [...ipCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([ip, count]) => ({ ip, count }));

    const userAlerts = new Map<string, number>();
    const rotaCount = new Map<string, number>();
    const porSeveridade: Record<string, number> = {};
    for (const a of alerts) {
      porSeveridade[a.tipo] = (porSeveridade[a.tipo] ?? 0) + 1;
      if (a.userId) {
        userAlerts.set(a.userId, (userAlerts.get(a.userId) ?? 0) + 1);
      }
      const r = (a.rota || '').slice(0, 200);
      if (r) rotaCount.set(r, (rotaCount.get(r) ?? 0) + 1);
    }

    const usuariosMaisAlertas = [...userAlerts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([userId, count]) => ({ userId, count }));

    const rotasExploradas = [...rotaCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([rota, count]) => ({ rota, count }));

    const critical = porSeveridade['CRÍTICO'] ?? 0;
    const alto = porSeveridade['ALTO'] ?? 0;
    const scoreAmbiente = Math.min(100, critical * 12 + alto * 6 + (alerts.length > 50 ? 10 : 0));

    return {
      topIps,
      fingerprintsBloqueados: fpsBlockedRaw.length,
      usuariosMaisAlertas,
      rotasExploradas,
      porSeveridade,
      scoreAmbiente,
    };
  }
}
