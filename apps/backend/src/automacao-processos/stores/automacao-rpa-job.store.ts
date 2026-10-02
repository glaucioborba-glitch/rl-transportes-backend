import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';
import type { RpaJob, RpaRobotId, RpaJobStatus } from '../automacao.types';

@Injectable()
export class AutomacaoRpaJobStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async registrar(inicio: Omit<RpaJob, 'id'>): Promise<RpaJob> {
    const id = randomUUID();
    const row = await this.prisma.automacaoRpaJob.create({
      data: {
        id,
        tenantId: this.tenantId(),
        robotId: inicio.robotId,
        status: inicio.status,
        mensagem: inicio.mensagem ?? null,
        tentativa: inicio.tentativa,
        startedAt: new Date(inicio.iniciadoEm),
        finishedAt: inicio.finalizadoEm ? new Date(inicio.finalizadoEm) : null,
      },
    });
    return this.mapRow(row);
  }

  async atualizar(
    id: string,
    patch: Partial<Pick<RpaJob, 'status' | 'finalizadoEm' | 'mensagem' | 'tentativa'>>,
  ): Promise<RpaJob | undefined> {
    const existing = await this.prisma.automacaoRpaJob.findFirst({
      where: { id, tenantId: this.tenantId() },
    });
    if (!existing) return undefined;

    const row = await this.prisma.automacaoRpaJob.update({
      where: { id },
      data: {
        status: patch.status,
        mensagem: patch.mensagem,
        tentativa: patch.tentativa,
        finishedAt: patch.finalizadoEm ? new Date(patch.finalizadoEm) : undefined,
      },
    });
    return this.mapRow(row);
  }

  async ultimos(n = 100): Promise<RpaJob[]> {
    const rows = await this.prisma.automacaoRpaJob.findMany({
      where: { tenantId: this.tenantId() },
      orderBy: { createdAt: 'desc' },
      take: n,
    });
    return rows.map((r) => this.mapRow(r));
  }

  static validarRobot(id: string): id is RpaRobotId {
    return [
      'rpa_faturamento_auto',
      'rpa_nfse_sugestao',
      'rpa_reconcilia_boleto',
      'rpa_operacao_ciclo',
      'rpa_rh_absenteismo',
      'rpa_grc_incidentes',
    ].includes(id);
  }

  private mapRow(row: {
    id: string;
    robotId: string;
    status: string;
    mensagem: string | null;
    tentativa: number;
    startedAt: Date;
    finishedAt: Date | null;
  }): RpaJob {
    return {
      id: row.id,
      robotId: row.robotId as RpaRobotId,
      status: row.status as RpaJobStatus,
      iniciadoEm: row.startedAt.toISOString(),
      finalizadoEm: row.finishedAt?.toISOString(),
      mensagem: row.mensagem ?? undefined,
      tentativa: row.tentativa,
    };
  }
}
