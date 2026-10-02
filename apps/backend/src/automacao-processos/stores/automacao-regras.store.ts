import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../../common/stores/store-tenant.util';
import type { RegraNegocio } from '../automacao.types';

@Injectable()
export class AutomacaoRegrasStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async listar(): Promise<RegraNegocio[]> {
    const rows = await this.prisma.automacaoRegra.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows.map((r) => this.mapRow(r));
  }

  async salvar(r: Omit<RegraNegocio, 'id' | 'criadoEm'> & { id?: string }): Promise<RegraNegocio> {
    const id = r.id ?? randomUUID();
    const tenantId = this.tenantId();
    const prev = r.id
      ? await this.prisma.automacaoRegra.findFirst({ where: { id, tenantId } })
      : null;

    const row = await this.prisma.automacaoRegra.upsert({
      where: { id },
      create: {
        id,
        tenantId,
        nome: r.nome,
        tipo: r.tipo,
        expressaoIf: r.if,
        acaoThen: r.then,
        acaoElse: r.else ?? null,
        ativo: r.ativo,
      },
      update: {
        nome: r.nome,
        tipo: r.tipo,
        expressaoIf: r.if,
        acaoThen: r.then,
        acaoElse: r.else ?? null,
        ativo: r.ativo,
      },
    });

    return {
      ...this.mapRow(row),
      criadoEm: prev ? prev.createdAt.toISOString() : row.createdAt.toISOString(),
    };
  }

  private mapRow(row: {
    id: string;
    nome: string;
    tipo: string;
    expressaoIf: string;
    acaoThen: string;
    acaoElse: string | null;
    ativo: boolean;
    createdAt: Date;
  }): RegraNegocio {
    return {
      id: row.id,
      nome: row.nome,
      tipo: row.tipo as RegraNegocio['tipo'],
      if: row.expressaoIf,
      then: row.acaoThen,
      else: row.acaoElse ?? undefined,
      ativo: row.ativo,
      criadoEm: row.createdAt.toISOString(),
    };
  }
}
