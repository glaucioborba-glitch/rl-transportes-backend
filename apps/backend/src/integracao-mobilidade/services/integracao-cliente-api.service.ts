import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, StatusSolicitacao } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegracaoEventLogStore } from '../stores/integracao-event-log.store';

export interface ClienteApiSolicitacaoRow {
  id: string;
  protocolo: string;
  status: StatusSolicitacao;
  createdAt: string;
  updatedAt: string;
  timestamps: {
    portaria?: string | null;
    gate?: string | null;
    patio?: string | null;
    saida?: string | null;
  };
  slaPrevistoHoras: number;
  slaRealHoras: number | null;
}

/** Tracking B2B read-only via Prisma (somente solicitações do cliente). */
@Injectable()
export class IntegracaoClienteApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventLog: IntegracaoEventLogStore,
  ) {}

  private slaPadraoHoras(): number {
    return Math.max(
      1,
      parseInt(this.config.get<string>('INTEGRACAO_SLA_HORAS_PADRAO') ?? '72', 10) || 72,
    );
  }

  private hoursBetween(a: Date, b: Date): number {
    return Math.round(((b.getTime() - a.getTime()) / 36e5) * 100) / 100;
  }

  async listSolicitacoes(clienteId: string): Promise<ClienteApiSolicitacaoRow[]> {
    try {
      const rows = await this.prisma.solicitacao.findMany({
        where: { clienteId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        include: {
          portaria: true,
          gate: true,
          patio: true,
          saida: true,
        },
      });
      const slaH = this.slaPadraoHoras();
      return rows.map((s) => this.mapRow(s, slaH));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022') return [];
      throw e;
    }
  }

  async getById(clienteId: string, id: string): Promise<ClienteApiSolicitacaoRow | null> {
    try {
      const s = await this.prisma.solicitacao.findFirst({
        where: { id, clienteId, deletedAt: null },
        include: { portaria: true, gate: true, patio: true, saida: true },
      });
      if (!s) return null;
      return this.mapRow(s, this.slaPadraoHoras());
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022') return null;
      throw e;
    }
  }

  private mapRow(
    s: {
      id: string;
      protocolo: string;
      status: StatusSolicitacao;
      createdAt: Date;
      updatedAt: Date;
      portaria: { updatedAt: Date; createdAt: Date } | null;
      gate: { updatedAt: Date; createdAt: Date } | null;
      patio: { updatedAt: Date; createdAt: Date } | null;
      saida: { dataHoraSaida: Date } | null;
    },
    slaPrevistoHoras: number,
  ): ClienteApiSolicitacaoRow {
    const slaRealHoras =
      s.status === StatusSolicitacao.CONCLUIDO
        ? this.hoursBetween(s.createdAt, s.updatedAt)
        : null;
    return {
      id: s.id,
      protocolo: s.protocolo,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      timestamps: {
        portaria: s.portaria?.updatedAt?.toISOString() ?? s.portaria?.createdAt?.toISOString() ?? null,
        gate: s.gate?.updatedAt?.toISOString() ?? s.gate?.createdAt?.toISOString() ?? null,
        patio: s.patio?.updatedAt?.toISOString() ?? s.patio?.createdAt?.toISOString() ?? null,
        saida: s.saida?.dataHoraSaida?.toISOString() ?? null,
      },
      slaPrevistoHoras,
      slaRealHoras,
    };
  }

  recentEvents(clienteId: string) {
    return this.eventLog.recent(clienteId, 50);
  }

  async metricsSlas(clienteId: string) {
    const rows = await this.listSolicitacoes(clienteId);
    const slaH = this.slaPadraoHoras();
    let dentro = 0;
    let fora = 0;
    for (const r of rows) {
      if (r.slaRealHoras === null) continue;
      if (r.slaRealHoras <= slaH) dentro += 1;
      else fora += 1;
    }
    return {
      slaPrevistoHoras: slaH,
      amostrasComConclusao: dentro + fora,
      dentroDoSla: dentro,
      foraDoSla: fora,
    };
  }
}
