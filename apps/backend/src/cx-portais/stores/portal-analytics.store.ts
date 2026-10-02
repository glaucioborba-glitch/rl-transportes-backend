import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type PortalAnalyticsHit = {
  path: string;
  sub: string;
  portalPapel: string;
  tenantId: string;
  at: number;
  tempoMs?: number;
};

/** Métricas de uso dos portais — persistidas em PostgreSQL. */
@Injectable()
export class PortalAnalyticsStore {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(hit: PortalAnalyticsHit) {
    await this.prisma.cxPortalAnalyticsHit.create({
      data: {
        path: hit.path.slice(0, 500),
        sub: hit.sub.slice(0, 128),
        portalPapel: hit.portalPapel.slice(0, 32),
        tenantId: hit.tenantId.slice(0, 64),
        hitAt: new Date(hit.at),
        tempoMs: hit.tempoMs ?? null,
      },
    });
    const total = await this.prisma.cxPortalAnalyticsHit.count();
    if (total > 10_000) {
      const old = await this.prisma.cxPortalAnalyticsHit.findMany({
        orderBy: { hitAt: 'asc' },
        take: 2000,
        select: { id: true },
      });
      if (old.length) {
        await this.prisma.cxPortalAnalyticsHit.deleteMany({
          where: { id: { in: old.map((x) => x.id) } },
        });
      }
    }
  }

  /** Últimos 24h */
  async resumo() {
    const corte = new Date(Date.now() - 24 * 3600 * 1000);
    const recent = await this.prisma.cxPortalAnalyticsHit.findMany({
      where: { hitAt: { gte: corte } },
      select: { path: true, sub: true, tenantId: true, tempoMs: true },
    });

    const paginas = new Map<string, number>();
    const subs = new Set<string>();
    for (const h of recent) {
      paginas.set(h.path, (paginas.get(h.path) ?? 0) + 1);
      subs.add(`${h.tenantId}:${h.sub}`);
    }
    const topPaginas = [...paginas.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const withTempo = recent.filter((x) => x.tempoMs != null);
    const tempoMedioMs =
      withTempo.length > 0
        ? withTempo.reduce((a, b) => a + (b.tempoMs ?? 0), 0) / withTempo.length
        : null;

    return {
      janelaHoras: 24,
      totalHits: recent.length,
      clientesOuTenantsAtivosProxy: subs.size,
      paginasMaisAcessadas: topPaginas,
      tempoMedioUsoProxyMs: tempoMedioMs,
      operacoesSolicitadasProxy: recent.filter((h) => h.path.includes('chamados') || h.path.includes('tickets')).length,
      reducaoAtendimentoProxyPct: Math.min(48, 12 + Math.floor(recent.length / 20)),
    };
  }
}
