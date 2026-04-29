import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MobileHubOpsStore } from '../../mobile-hub/stores/mobile-hub-ops.store';
import type { MobileHubOpEntry } from '../../mobile-hub/stores/mobile-hub-ops.store';

@Injectable()
export class CockpitMapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mobileOps: MobileHubOpsStore,
  ) {}

  private capacidadePatio() {
    return Math.max(10, parseInt(this.config.get<string>('COCKPIT_PATIO_CAPACIDADE') ?? '280', 10) || 280);
  }

  /** Layout lógico + ocupação + heatmap proxy. */
  async patio() {
    const [patios, totalSol] = await Promise.all([
      this.prisma.patio.findMany({
        include: {
          solicitacao: {
            select: { protocolo: true, status: true, clienteId: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 500,
      }),
      this.prisma.solicitacao.count({ where: { deletedAt: null } }),
    ]);
    const cap = this.capacidadePatio();
    const ocupados = patios.length;
    const recentMob = this.mobileOps.ultimos(120);
    const heatmap = this.heatmapPorQuadra(patios, recentMob);
    return {
      geradoEm: new Date().toISOString(),
      capacidadeTotal: cap,
      slotsOcupados: ocupados,
      slotsLivresProximo: Math.max(0, cap - ocupados),
      ocupacaoPct: cap ? Math.round((ocupados / cap) * 100) : 0,
      solicitacoesTotalProxy: totalSol,
      heatmapCongestionamento: heatmap,
      posicoes: patios.map((p) => ({
        solicitacaoId: p.solicitacaoId,
        protocolo: p.solicitacao.protocolo,
        quadra: p.quadra,
        fileira: p.fileira,
        posicao: p.posicao,
        status: p.solicitacao.status,
        atualizadoEm: p.updatedAt.toISOString(),
      })),
      movimentacoesRecentesMobile: recentMob
        .filter((x) => x.canal === 'patio' || x.canal === 'gate_in' || x.canal === 'gate_out')
        .slice(0, 40)
        .map((x) => ({
          id: x.id,
          canal: x.canal,
          protocolo: x.protocolo,
          recebidoEm: x.recebidoEm,
        })),
    };
  }

  private heatmapPorQuadra(
    patios: Array<{ quadra: string; fileira: string; posicao: string }>,
    mobile: MobileHubOpEntry[],
  ) {
    const m = new Map<string, number>();
    for (const p of patios) {
      const k = p.quadra || '—';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    for (const op of mobile) {
      const q = (op.resumo?.quadra as string | undefined) ?? (op.resumo?.extras as { quadra?: string } | undefined)?.quadra;
      if (q) m.set(q, (m.get(q) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([quadra, peso]) => ({ quadra, peso }))
      .sort((a, b) => b.peso - a.peso)
      .slice(0, 24);
  }

  async gate() {
    const [ins, outs, mob] = await Promise.all([
      this.prisma.gate.findMany({
        include: { solicitacao: { select: { protocolo: true, status: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
      this.prisma.saida.findMany({
        include: { solicitacao: { select: { protocolo: true, status: true } } },
        orderBy: { dataHoraSaida: 'desc' },
        take: 200,
      }),
      Promise.resolve(this.mobileOps.ultimos(80).filter((x) => x.canal === 'gate_in' || x.canal === 'gate_out')),
    ]);

    return {
      geradoEm: new Date().toISOString(),
      gateInRegistrados: ins.length,
      saidasRegistradas: outs.length,
      ultimosGateIn: ins.slice(0, 40).map((g) => ({
        protocolo: g.solicitacao.protocolo,
        atualizadoEm: g.updatedAt.toISOString(),
      })),
      ultimasSaidas: outs.slice(0, 40).map((s) => ({
        protocolo: s.solicitacao.protocolo,
        dataHoraSaida: s.dataHoraSaida.toISOString(),
      })),
      trilhasVeiculosMobileProxy: mob.slice(0, 30).map((x) => ({
        protocolo: x.protocolo,
        etapa: x.canal,
        em: x.recebidoEm,
      })),
    };
  }

  async portaria() {
    const [por, mob] = await Promise.all([
      this.prisma.portaria.findMany({
        include: { solicitacao: { select: { protocolo: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      Promise.resolve(this.mobileOps.ultimos(60).filter((x) => x.canal === 'portaria')),
    ]);
    return {
      geradoEm: new Date().toISOString(),
      totalCheckins: por.length,
      filaProxy: por.filter((p) => p.solicitacao.status === 'PENDENTE' || p.solicitacao.status === 'APROVADO')
        .length,
      ultimos: por.slice(0, 50).map((p) => ({
        protocolo: p.solicitacao.protocolo,
        statusSolicitacao: p.solicitacao.status,
        criadoEm: p.createdAt.toISOString(),
      })),
      eventosMobilePortaria: mob.slice(0, 25).map((x) => ({
        protocolo: x.protocolo,
        em: x.recebidoEm,
      })),
    };
  }

  async veiculos() {
    const sols = await this.prisma.solicitacao.findMany({
      where: { deletedAt: null, status: { not: 'REJEITADO' } },
      include: { portaria: true, gate: true, patio: true, saida: true },
      orderBy: { updatedAt: 'desc' },
      take: 150,
    });

    type Estagio = 'portaria' | 'gate_in' | 'patio' | 'gate_out' | 'concluido';
    const stages: { s: Estagio; ord: number }[] = [];
    const items = sols.map((s) => {
      let estagio: Estagio = 'portaria';
      let ord = 0;
      if (s.saida) {
        estagio = 'concluido';
        ord = 4;
      } else if (s.patio) {
        estagio = 'patio';
        ord = 2;
      } else if (s.gate) {
        estagio = 'gate_in';
        ord = 1;
      } else if (s.portaria) {
        estagio = 'portaria';
        ord = 0;
      }
      stages.push({ s: estagio, ord });
      return {
        protocolo: s.protocolo,
        status: s.status,
        estagio,
        ord,
        atualizadoEm: s.updatedAt.toISOString(),
        patio: s.patio
          ? { quadra: s.patio.quadra, fileira: s.patio.fileira, posicao: s.patio.posicao }
          : null,
      };
    });

    return {
      geradoEm: new Date().toISOString(),
      totalRastreados: items.length,
      emPatio: items.filter((i) => i.estagio === 'patio').length,
      emGate: items.filter((i) => i.estagio === 'gate_in').length,
      concluidosRecentes: items.filter((i) => i.estagio === 'concluido').length,
      veiculos: items,
      caminhosAtivosProxy: items
        .filter((i) => i.estagio !== 'concluido')
        .slice(0, 60)
        .map((i) => ({ p: i.protocolo, estagio: i.estagio })),
    };
  }
}
