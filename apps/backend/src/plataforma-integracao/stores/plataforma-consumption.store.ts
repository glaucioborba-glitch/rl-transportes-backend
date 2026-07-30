import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ConsumoRegistro } from '../plataforma.types';

@Injectable()
export class PlataformaConsumptionStore {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(r: Omit<ConsumoRegistro, 'id' | 'criadoEm'>): Promise<ConsumoRegistro> {
    const id = randomUUID();
    const row = await this.prisma.plataformaConsumoLog.create({
      data: {
        id,
        tenantId: r.tenantId,
        apiClientId: r.apiClientId,
        rota: r.rota,
        metodo: r.metodo,
        statusHttp: r.statusHttp,
        latencyMs: r.latencyMs,
      },
    });
    return {
      id: row.id,
      apiClientId: row.apiClientId,
      rota: row.rota,
      metodo: row.metodo,
      statusHttp: row.statusHttp,
      latencyMs: row.latencyMs,
      tenantId: row.tenantId,
      criadoEm: row.createdAt.toISOString(),
    };
  }

  registrarIncidente(tipo: string, detalhe: string) {
    void this.prisma.plataformaConsumoIncidente
      .create({
        data: { id: randomUUID(), tipo, detalhe },
      })
      .catch(() => {});
  }

  async ultimos(lim = 500): Promise<ConsumoRegistro[]> {
    const rows = await this.prisma.plataformaConsumoLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: lim,
    });
    return rows.map((row) => ({
      id: row.id,
      apiClientId: row.apiClientId,
      rota: row.rota,
      metodo: row.metodo,
      statusHttp: row.statusHttp,
      latencyMs: row.latencyMs,
      tenantId: row.tenantId,
      criadoEm: row.createdAt.toISOString(),
    }));
  }

  async incidentes(lim = 50) {
    const rows = await this.prisma.plataformaConsumoIncidente.findMany({
      orderBy: { createdAt: 'desc' },
      take: lim,
    });
    return rows.map((row) => ({
      id: row.id,
      tipo: row.tipo,
      detalhe: row.detalhe,
      criadoEm: row.createdAt.toISOString(),
    }));
  }

  async agregarPorCliente() {
    const rows = await this.prisma.plataformaConsumoLog.groupBy({
      by: ['apiClientId'],
      _count: { _all: true },
      _sum: { latencyMs: true },
    });

    const erros = await this.prisma.plataformaConsumoLog.findMany({
      where: { statusHttp: { gte: 400 } },
      select: { apiClientId: true, statusHttp: true },
    });

    const errMap = new Map<string, { erros4xx: number; erros5xx: number }>();
    for (const e of erros) {
      const cur = errMap.get(e.apiClientId) ?? { erros4xx: 0, erros5xx: 0 };
      if (e.statusHttp >= 400 && e.statusHttp < 500) cur.erros4xx += 1;
      if (e.statusHttp >= 500) cur.erros5xx += 1;
      errMap.set(e.apiClientId, cur);
    }

    return rows.map((r) => {
      const err = errMap.get(r.apiClientId) ?? { erros4xx: 0, erros5xx: 0 };
      const chamadas = r._count._all;
      const latenciaSoma = r._sum.latencyMs ?? 0;
      return {
        apiClientId: r.apiClientId,
        chamadas,
        erros4xx: err.erros4xx,
        erros5xx: err.erros5xx,
        latenciaSoma,
        latenciaMediaMs: chamadas ? Math.round(latenciaSoma / chamadas) : 0,
      };
    });
  }

  async rotasMaisChamadas(top = 20) {
    const rows = await this.prisma.plataformaConsumoLog.groupBy({
      by: ['rota'],
      _count: { _all: true },
      orderBy: { _count: { rota: 'desc' } },
      take: top,
    });
    return rows.map((r) => ({ rota: r.rota, qt: r._count._all }));
  }
}
