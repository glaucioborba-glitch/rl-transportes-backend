import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';
import type { WorkflowDef } from '../automacao.types';

@Injectable()
export class AutomacaoWorkflowStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async listar(): Promise<WorkflowDef[]> {
    const rows = await this.prisma.automacaoWorkflow.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows
      .map((r) => this.mapRow(r))
      .sort((a, b) => a.prioridade - b.prioridade || a.criadoEm.localeCompare(b.criadoEm));
  }

  async porEvento(evento: string): Promise<WorkflowDef[]> {
    const rows = await this.prisma.automacaoWorkflow.findMany({
      where: { tenantId: this.tenantId(), ativo: true, eventoDisparo: evento },
    });
    return rows.map((r) => this.mapRow(r)).sort((a, b) => a.prioridade - b.prioridade);
  }

  async obter(id: string): Promise<WorkflowDef | undefined> {
    const row = await this.prisma.automacaoWorkflow.findFirst({
      where: { id, tenantId: this.tenantId() },
    });
    return row ? this.mapRow(row) : undefined;
  }

  async salvar(
    w: Omit<WorkflowDef, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: string },
  ): Promise<WorkflowDef> {
    const id = w.id ?? randomUUID();
    const tenantId = this.tenantId();
    const prev = w.id
      ? await this.prisma.automacaoWorkflow.findFirst({ where: { id, tenantId } })
      : null;

    const row = await this.prisma.automacaoWorkflow.upsert({
      where: { id },
      create: {
        id,
        tenantId,
        nome: w.nome,
        eventoDisparo: w.eventoDisparo,
        condicoes: w.condicoes as object,
        acoes: w.acoes as object,
        prioridade: w.prioridade,
        ativo: w.ativo,
      },
      update: {
        nome: w.nome,
        eventoDisparo: w.eventoDisparo,
        condicoes: w.condicoes as object,
        acoes: w.acoes as object,
        prioridade: w.prioridade,
        ativo: w.ativo,
      },
    });

    return {
      ...this.mapRow(row),
      criadoEm: prev ? prev.createdAt.toISOString() : row.createdAt.toISOString(),
    };
  }

  async remover(id: string): Promise<boolean> {
    const res = await this.prisma.automacaoWorkflow.deleteMany({
      where: { id, tenantId: this.tenantId() },
    });
    return res.count > 0;
  }

  async definirAtivo(id: string, ativo: boolean): Promise<WorkflowDef | undefined> {
    const existing = await this.prisma.automacaoWorkflow.findFirst({
      where: { id, tenantId: this.tenantId() },
    });
    if (!existing) return undefined;
    const row = await this.prisma.automacaoWorkflow.update({
      where: { id },
      data: { ativo },
    });
    return this.mapRow(row);
  }

  private mapRow(row: {
    id: string;
    nome: string;
    eventoDisparo: string;
    condicoes: unknown;
    acoes: unknown;
    prioridade: number;
    ativo: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): WorkflowDef {
    return {
      id: row.id,
      nome: row.nome,
      eventoDisparo: row.eventoDisparo,
      condicoes: Array.isArray(row.condicoes) ? row.condicoes : [],
      acoes: Array.isArray(row.acoes) ? row.acoes : [],
      prioridade: row.prioridade as WorkflowDef['prioridade'],
      ativo: row.ativo,
      criadoEm: row.createdAt.toISOString(),
      atualizadoEm: row.updatedAt.toISOString(),
    };
  }
}
