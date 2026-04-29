import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MobileHubOpsStore } from '../../mobile-hub/stores/mobile-hub-ops.store';

@Injectable()
export class CockpitIndicadoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mobileOps: MobileHubOpsStore,
  ) {}

  private capacidade() {
    return Math.max(10, parseInt(this.config.get<string>('COCKPIT_PATIO_CAPACIDADE') ?? '280', 10) || 280);
  }

  async resumo() {
    const h24 = new Date(Date.now() - 24 * 3600 * 1000);
    const [gates24, saidas24, patios, solsCliente, mobOps] = await Promise.all([
      this.prisma.gate.count({ where: { updatedAt: { gte: h24 } } }),
      this.prisma.saida.count({ where: { dataHoraSaida: { gte: h24 } } }),
      this.prisma.patio.findMany({
        include: { solicitacao: { select: { id: true, createdAt: true, updatedAt: true } } },
      }),
      this.prisma.solicitacao.groupBy({
        by: ['clienteId', 'status'],
        where: { deletedAt: null },
        _count: true,
      }),
      Promise.resolve(this.mobileOps.ultimos(400)),
    ]);

    const cap = this.capacidade();
    const ocupPct = cap ? Math.round((patios.length / cap) * 100) : 0;

    let permMin = 0;
    let permN = 0;
    for (const p of patios) {
      const t0 = p.solicitacao.createdAt.getTime();
      const t1 = p.updatedAt.getTime();
      permMin += (t1 - t0) / 60000;
      permN += 1;
    }
    const permanenciaMediaMin = permN ? Math.round(permMin / permN) : 0;

    const gateInPerH = round2(gates24 / 24);
    const gateOutPerH = round2(saidas24 / 24);

    const porCliente = new Map<string, { total: number; concluido: number }>();
    for (const row of solsCliente) {
      const cur = porCliente.get(row.clienteId) ?? { total: 0, concluido: 0 };
      cur.total += row._count;
      if (row.status === 'CONCLUIDO') cur.concluido += row._count;
      porCliente.set(row.clienteId, cur);
    }
    const slaCliente = [...porCliente.entries()].map(([clienteId, v]) => ({
      clienteId,
      slaRealizadoPct: v.total ? Math.round((v.concluido / v.total) * 100) : 0,
    }));

    const porUser = new Map<string, number>();
    for (const o of mobOps) {
      porUser.set(o.userId, (porUser.get(o.userId) ?? 0) + 1);
    }
    const uphMobileProxy = [...porUser.entries()]
      .map(([operadorSub, ops]) => ({ operadorSub, ops24hProxy: ops }))
      .sort((a, b) => b.ops24hProxy - a.ops24hProxy)
      .slice(0, 20);

    return {
      geradoEm: new Date().toISOString(),
      janelaHoras: 24,
      throughput: {
        gateInPorHora: gateInPerH,
        gateOutPorHora: gateOutPerH,
      },
      patio: {
        ocupacaoPct: ocupPct,
        permanenciaMediaMin,
        capacidadeInstalada: cap,
        unidadesNoPatio: patios.length,
      },
      slaPorCliente: slaCliente.slice(0, 40),
      rankingProdutividadeMobile: uphMobileProxy,
      riscoOperacionalScoreProxy: Math.min(100, 20 + (100 - ocupPct) * 0.2 + gateInPerH * 2),
    };
  }

  async turno() {
    const slice = new Date().toISOString().slice(0, 10);
    const base = await this.resumo();
    const turnoId = `cockpit_turno_${slice}`;
    return {
      turnoId,
      periodo: slice,
      indicadores: base,
      mensagem:
        'Ranking por turno é proxy diário nesta fase; integração com folha/escala em evolução.',
    };
  }
}

function round2(x: number) {
  return Math.round(x * 100) / 100;
}
