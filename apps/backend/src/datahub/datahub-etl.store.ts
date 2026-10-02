import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../common/stores/store-tenant.util';
import type { EtlExecucao, EtlFase } from './datahub.types';

@Injectable()
export class DatahubEtlStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async registrar(exec: Omit<EtlExecucao, 'id'>): Promise<EtlExecucao> {
    const id = randomUUID();
    const row = await this.prisma.datahubEtlExecucao.create({
      data: {
        id,
        tenantId: this.tenantId(),
        fase: exec.fase,
        status: exec.status,
        iniciadoEm: new Date(exec.iniciadoEm),
        finalizadoEm: new Date(exec.finalizadoEm),
        duracaoMs: exec.duracaoMs,
        linhasEntrada: exec.linhasEntrada ?? null,
        linhasSaida: exec.linhasSaida ?? null,
        mensagem: exec.mensagem ?? null,
      },
    });
    return this.mapRow(row);
  }

  async metricasAgregadas() {
    const tenantId = this.tenantId();
    const execs = await this.prisma.datahubEtlExecucao.findMany({
      where: { tenantId },
      select: {
        fase: true,
        status: true,
        duracaoMs: true,
        linhasSaida: true,
      },
    });

    let volumeExtracaoTotal = 0;
    let volumeTransformacaoTotal = 0;
    let volumeCargaTotal = 0;
    let falhas = 0;
    const tempoMedioExecucaoMs: number[] = [];

    for (const e of execs) {
      if (e.status === 'FALHA') falhas += 1;
      if (e.fase === 'extrair' && e.linhasSaida != null) volumeExtracaoTotal += e.linhasSaida;
      if (e.fase === 'transformar' && e.linhasSaida != null) volumeTransformacaoTotal += e.linhasSaida;
      if (e.fase === 'carregar' && e.linhasSaida != null) volumeCargaTotal += e.linhasSaida;
      tempoMedioExecucaoMs.push(e.duracaoMs);
    }

    const lat = tempoMedioExecucaoMs;
    const avg = lat.length > 0 ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;

    return {
      volumeExtracaoLinhas: volumeExtracaoTotal,
      volumeTransformacaoLinhas: volumeTransformacaoTotal,
      volumeCargaLinhas: volumeCargaTotal,
      tempoMedioExecucaoMs: avg,
      execucoesRegistradas: execs.length,
      falhas,
    };
  }

  async ultimasExecucoes(limit = 80): Promise<EtlExecucao[]> {
    const rows = await this.prisma.datahubEtlExecucao.findMany({
      where: { tenantId: this.tenantId() },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => this.mapRow(r));
  }

  async filtrarPorFase(fase: EtlFase): Promise<EtlExecucao[]> {
    const rows = await this.prisma.datahubEtlExecucao.findMany({
      where: { tenantId: this.tenantId(), fase },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(row: {
    id: string;
    fase: string;
    status: string;
    iniciadoEm: Date;
    finalizadoEm: Date;
    duracaoMs: number;
    linhasEntrada: number | null;
    linhasSaida: number | null;
    mensagem: string | null;
  }): EtlExecucao {
    return {
      id: row.id,
      fase: row.fase as EtlExecucao['fase'],
      status: row.status as EtlExecucao['status'],
      iniciadoEm: row.iniciadoEm.toISOString(),
      finalizadoEm: row.finalizadoEm.toISOString(),
      duracaoMs: row.duracaoMs,
      linhasEntrada: row.linhasEntrada ?? undefined,
      linhasSaida: row.linhasSaida ?? undefined,
      mensagem: row.mensagem ?? undefined,
    };
  }
}
