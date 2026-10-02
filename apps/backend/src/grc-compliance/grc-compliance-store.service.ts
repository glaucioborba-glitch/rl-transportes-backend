import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../common/stores/store-tenant.util';
import type {
  ControleInternoEntity,
  PlanoAcaoGrcEntity,
  RiscoGrcEntity,
} from './grc-compliance.domain';

@Injectable()
export class GrcComplianceStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async createRisco(input: Omit<RiscoGrcEntity, 'id' | 'createdAt'>): Promise<RiscoGrcEntity> {
    const id = randomUUID();
    const row = await this.prisma.grcRisco.create({
      data: {
        id,
        tenantId: this.tenantId(),
        titulo: input.titulo,
        descricao: input.descricao,
        categoria: input.categoria,
        probabilidade: input.probabilidade,
        impacto: input.impacto,
        severidade: input.severidade,
        status: input.status,
        responsavel: input.responsavel,
        origem: input.origem,
      },
    });
    return this.mapRisco(row);
  }

  async listRiscos(): Promise<RiscoGrcEntity[]> {
    const rows = await this.prisma.grcRisco.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows.map((r) => this.mapRisco(r)).sort((a, b) => b.severidade - a.severidade);
  }

  async getRisco(id: string): Promise<RiscoGrcEntity | undefined> {
    const row = await this.prisma.grcRisco.findFirst({
      where: { id, tenantId: this.tenantId() },
    });
    return row ? this.mapRisco(row) : undefined;
  }

  async createControle(
    input: Omit<ControleInternoEntity, 'id' | 'createdAt'>,
  ): Promise<ControleInternoEntity> {
    const id = randomUUID();
    const row = await this.prisma.grcControle.create({
      data: {
        id,
        tenantId: this.tenantId(),
        riscoRelacionadoId: input.riscoRelacionadoId,
        nomeControle: input.nomeControle,
        frequencia: input.frequencia,
        responsavel: input.responsavel,
        evidencia: input.evidencia ?? null,
        eficacia: input.eficacia,
      },
    });
    return this.mapControle(row);
  }

  async listControles(): Promise<ControleInternoEntity[]> {
    const rows = await this.prisma.grcControle.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows
      .map((r) => this.mapControle(r))
      .sort((a, b) => a.nomeControle.localeCompare(b.nomeControle, 'pt-BR'));
  }

  async createPlano(
    input: Omit<PlanoAcaoGrcEntity, 'id' | 'createdAt'>,
  ): Promise<PlanoAcaoGrcEntity> {
    const id = randomUUID();
    const row = await this.prisma.grcPlanoAcao.create({
      data: {
        id,
        tenantId: this.tenantId(),
        what: input.what,
        why: input.why,
        where: input.where,
        when: input.when,
        who: input.who,
        how: input.how,
        howMuch: input.howMuch,
        status: input.status,
      },
    });
    return this.mapPlano(row);
  }

  async listPlanos(): Promise<PlanoAcaoGrcEntity[]> {
    const rows = await this.prisma.grcPlanoAcao.findMany({
      where: { tenantId: this.tenantId() },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapPlano(r));
  }

  async assertRiscoExists(id: string): Promise<void> {
    const row = await this.getRisco(id);
    if (!row) throw new BadRequestException('riscoRelacionadoId não encontrado.');
  }

  private mapRisco(row: {
    id: string;
    titulo: string;
    descricao: string;
    categoria: string;
    probabilidade: number;
    impacto: number;
    severidade: number;
    status: string;
    responsavel: string;
    origem: string;
    createdAt: Date;
  }): RiscoGrcEntity {
    return {
      id: row.id,
      titulo: row.titulo,
      descricao: row.descricao,
      categoria: row.categoria as RiscoGrcEntity['categoria'],
      probabilidade: row.probabilidade,
      impacto: row.impacto,
      severidade: row.severidade,
      status: row.status as RiscoGrcEntity['status'],
      responsavel: row.responsavel,
      origem: row.origem as RiscoGrcEntity['origem'],
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapControle(row: {
    id: string;
    riscoRelacionadoId: string;
    nomeControle: string;
    frequencia: string;
    responsavel: string;
    evidencia: string | null;
    eficacia: number;
    createdAt: Date;
  }): ControleInternoEntity {
    return {
      id: row.id,
      riscoRelacionadoId: row.riscoRelacionadoId,
      nomeControle: row.nomeControle,
      frequencia: row.frequencia as ControleInternoEntity['frequencia'],
      responsavel: row.responsavel,
      evidencia: row.evidencia ?? undefined,
      eficacia: row.eficacia,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapPlano(row: {
    id: string;
    what: string;
    why: string;
    where: string;
    when: string;
    who: string;
    how: string;
    howMuch: { toNumber(): number } | number;
    status: string;
    createdAt: Date;
  }): PlanoAcaoGrcEntity {
    return {
      id: row.id,
      what: row.what,
      why: row.why,
      where: row.where,
      when: row.when,
      who: row.who,
      how: row.how,
      howMuch: typeof row.howMuch === 'number' ? row.howMuch : row.howMuch.toNumber(),
      status: row.status as PlanoAcaoGrcEntity['status'],
      createdAt: row.createdAt.toISOString(),
    };
  }
}
