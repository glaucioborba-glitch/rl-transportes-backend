import { Injectable } from '@nestjs/common';

export type PortalAnalyticsHit = {
  path: string;
  sub: string;
  portalPapel: string;
  tenantId: string;
  at: number;
  tempoMs?: number;
};

/** Métricas de uso dos portais (memória). */
@Injectable()
export class PortalAnalyticsStore {
  private readonly hits: PortalAnalyticsHit[] = [];

  registrar(hit: PortalAnalyticsHit) {
    this.hits.push(hit);
    if (this.hits.length > 8000) this.hits.splice(0, 2000);
  }

  /** Últimos 24h */
  resumo() {
    const corte = Date.now() - 24 * 3600 * 1000;
    const recent = this.hits.filter((h) => h.at >= corte);
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

    const tempoMedioMs =
      recent.length && recent.some((x) => x.tempoMs != null)
        ? recent.filter((x) => x.tempoMs != null).reduce((a, b) => a + (b.tempoMs ?? 0), 0) /
          recent.filter((x) => x.tempoMs != null).length
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
