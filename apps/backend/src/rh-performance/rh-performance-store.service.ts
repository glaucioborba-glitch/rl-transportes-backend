import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../common/stores/store-tenant.util';
import type {
  AvaliacaoRhEntity,
  OkrRhEntity,
  TreinamentoRhEntity,
} from './rh-performance.domain';

@Injectable()
export class RhPerformanceStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async createAvaliacao(input: Omit<AvaliacaoRhEntity, 'id' | 'createdAt'>): Promise<AvaliacaoRhEntity> {
    const id = randomUUID();
    const row = await this.prisma.rhAvaliacao.create({
      data: {
        id,
        tenantId: this.tenantId(),
        colaboradorId: input.colaboradorId,
        turnoReferencia: input.turnoReferencia ?? null,
        cargoReferencia: input.cargoReferencia ?? null,
        periodo: input.periodo,
        avaliador: input.avaliador,
        notaTecnica: input.notaTecnica,
        notaComportamental: input.notaComportamental,
        aderenciaProcedimentos: input.aderenciaProcedimentos,
        qualidadeExecucao: input.qualidadeExecucao,
        comprometimento: input.comprometimento,
        comentarioGerencial: input.comentarioGerencial ?? null,
        scoreFinal: input.scoreFinal,
      },
    });
    return this.mapAvaliacao(row);
  }

  async listAvaliacoes(): Promise<AvaliacaoRhEntity[]> {
    const rows = await this.prisma.rhAvaliacao.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows.map((r) => this.mapAvaliacao(r)).sort((a, b) => b.periodo.localeCompare(a.periodo));
  }

  async createOkr(input: Omit<OkrRhEntity, 'id' | 'createdAt'>): Promise<OkrRhEntity> {
    const id = randomUUID();
    const row = await this.prisma.rhOkr.create({
      data: {
        id,
        tenantId: this.tenantId(),
        objetivo: input.objetivo,
        escopo: input.escopo,
        keyResults: input.keyResults,
        progressoAtual: input.progressoAtual,
        periodoInicio: new Date(input.periodoInicio.slice(0, 10)),
        periodoFim: new Date(input.periodoFim.slice(0, 10)),
        responsavel: input.responsavel,
      },
    });
    return this.mapOkr(row);
  }

  async listOkrs(): Promise<OkrRhEntity[]> {
    const rows = await this.prisma.rhOkr.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows
      .map((r) => this.mapOkr(r))
      .sort((a, b) => b.periodoInicio.localeCompare(a.periodoInicio));
  }

  async createTreinamento(input: Omit<TreinamentoRhEntity, 'id' | 'createdAt'>): Promise<TreinamentoRhEntity> {
    const id = randomUUID();
    const row = await this.prisma.rhTreinamento.create({
      data: {
        id,
        tenantId: this.tenantId(),
        colaboradorId: input.colaboradorId,
        modulo: input.modulo,
        cargaHoraria: input.cargaHoraria,
        status: input.status,
        dataConclusao: input.dataConclusao ? new Date(input.dataConclusao.slice(0, 10)) : null,
      },
    });
    return this.mapTreinamento(row);
  }

  async listTreinamentos(): Promise<TreinamentoRhEntity[]> {
    const rows = await this.prisma.rhTreinamento.findMany({
      where: { tenantId: this.tenantId() },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapTreinamento(r));
  }

  async treinamentosPorColaborador(colaboradorId: string): Promise<TreinamentoRhEntity[]> {
    const rows = await this.prisma.rhTreinamento.findMany({
      where: { tenantId: this.tenantId(), colaboradorId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapTreinamento(r));
  }

  private mapAvaliacao(row: {
    id: string;
    colaboradorId: string;
    turnoReferencia: string | null;
    cargoReferencia: string | null;
    periodo: string;
    avaliador: string;
    notaTecnica: { toNumber(): number } | number;
    notaComportamental: { toNumber(): number } | number;
    aderenciaProcedimentos: { toNumber(): number } | number;
    qualidadeExecucao: { toNumber(): number } | number;
    comprometimento: { toNumber(): number } | number;
    comentarioGerencial: string | null;
    scoreFinal: { toNumber(): number } | number;
    createdAt: Date;
  }): AvaliacaoRhEntity {
    const num = (v: { toNumber(): number } | number) => (typeof v === 'number' ? v : v.toNumber());
    return {
      id: row.id,
      colaboradorId: row.colaboradorId,
      turnoReferencia: (row.turnoReferencia as AvaliacaoRhEntity['turnoReferencia']) ?? undefined,
      cargoReferencia: row.cargoReferencia ?? undefined,
      periodo: row.periodo,
      avaliador: row.avaliador,
      notaTecnica: num(row.notaTecnica),
      notaComportamental: num(row.notaComportamental),
      aderenciaProcedimentos: num(row.aderenciaProcedimentos),
      qualidadeExecucao: num(row.qualidadeExecucao),
      comprometimento: num(row.comprometimento),
      comentarioGerencial: row.comentarioGerencial ?? undefined,
      scoreFinal: num(row.scoreFinal),
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapOkr(row: {
    id: string;
    objetivo: string;
    escopo: string;
    keyResults: unknown;
    progressoAtual: { toNumber(): number } | number;
    periodoInicio: Date;
    periodoFim: Date;
    responsavel: string;
    createdAt: Date;
  }): OkrRhEntity {
    return {
      id: row.id,
      objetivo: row.objetivo,
      escopo: row.escopo as OkrRhEntity['escopo'],
      keyResults: Array.isArray(row.keyResults) ? (row.keyResults as string[]) : [],
      progressoAtual: typeof row.progressoAtual === 'number' ? row.progressoAtual : row.progressoAtual.toNumber(),
      periodoInicio: row.periodoInicio.toISOString().slice(0, 10),
      periodoFim: row.periodoFim.toISOString().slice(0, 10),
      responsavel: row.responsavel,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapTreinamento(row: {
    id: string;
    colaboradorId: string;
    modulo: string;
    cargaHoraria: number;
    status: string;
    dataConclusao: Date | null;
    createdAt: Date;
  }): TreinamentoRhEntity {
    return {
      id: row.id,
      colaboradorId: row.colaboradorId,
      modulo: row.modulo,
      cargaHoraria: row.cargaHoraria,
      status: row.status as TreinamentoRhEntity['status'],
      dataConclusao: row.dataConclusao?.toISOString().slice(0, 10),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
