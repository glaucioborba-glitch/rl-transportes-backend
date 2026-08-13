import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { resolveStoreTenantId } from '../common/stores/store-tenant.util';
import type {
  ContratoEntity,
  DespesaEntity,
  FornecedorEntity,
} from './tesouraria.domain';

@Injectable()
export class TesourariaStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCtx: TenantContextService,
  ) {}

  private tenantId() {
    return resolveStoreTenantId(this.tenantCtx);
  }

  async createFornecedor(input: Omit<FornecedorEntity, 'id' | 'createdAt'>): Promise<FornecedorEntity> {
    const id = randomUUID();
    const row = await this.prisma.tesourariaFornecedor.create({
      data: {
        id,
        tenantId: this.tenantId(),
        nome: input.nome,
        cnpj: input.cnpj,
        categoriaFornecedor: input.categoriaFornecedor,
        contato: input.contato,
        prazoPagamentoPadrao: input.prazoPagamentoPadrao,
      },
    });
    return this.mapFornecedor(row);
  }

  async listFornecedores(): Promise<FornecedorEntity[]> {
    const rows = await this.prisma.tesourariaFornecedor.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows.map((r) => this.mapFornecedor(r)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async getFornecedor(id: string): Promise<FornecedorEntity | undefined> {
    const row = await this.prisma.tesourariaFornecedor.findFirst({
      where: { id, tenantId: this.tenantId() },
    });
    return row ? this.mapFornecedor(row) : undefined;
  }

  async createDespesa(input: Omit<DespesaEntity, 'id' | 'createdAt'>): Promise<DespesaEntity> {
    const id = randomUUID();
    const row = await this.prisma.tesourariaDespesa.create({
      data: {
        id,
        tenantId: this.tenantId(),
        fornecedor: input.fornecedor,
        categoria: input.categoria,
        descricao: input.descricao,
        valor: input.valor,
        vencimento: new Date(input.vencimento.slice(0, 10)),
        status: input.status,
        recorrencia: input.recorrencia,
        documentoReferencia: input.documentoReferencia ?? null,
      },
    });
    return this.mapDespesa(row);
  }

  async listDespesas(): Promise<DespesaEntity[]> {
    const rows = await this.prisma.tesourariaDespesa.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows
      .map((r) => this.mapDespesa(r))
      .sort((a, b) => new Date(b.vencimento).getTime() - new Date(a.vencimento).getTime());
  }

  async getDespesa(id: string): Promise<DespesaEntity | undefined> {
    const row = await this.prisma.tesourariaDespesa.findFirst({
      where: { id, tenantId: this.tenantId() },
    });
    return row ? this.mapDespesa(row) : undefined;
  }

  async createContrato(input: Omit<ContratoEntity, 'id' | 'createdAt'>): Promise<ContratoEntity> {
    const id = randomUUID();
    const row = await this.prisma.tesourariaContrato.create({
      data: {
        id,
        tenantId: this.tenantId(),
        fornecedorId: input.fornecedorId,
        tipoContrato: input.tipoContrato,
        valorFixo: input.valorFixo,
        vigenciaInicio: new Date(input.vigenciaInicio.slice(0, 10)),
        vigenciaFim: new Date(input.vigenciaFim.slice(0, 10)),
        reajusteAnualPct: input.reajusteAnualPct,
        observacoes: input.observacoes ?? null,
      },
    });
    return this.mapContrato(row);
  }

  async listContratos(): Promise<ContratoEntity[]> {
    const rows = await this.prisma.tesourariaContrato.findMany({
      where: { tenantId: this.tenantId() },
    });
    return rows
      .map((r) => this.mapContrato(r))
      .sort((a, b) => new Date(a.vigenciaInicio).getTime() - new Date(b.vigenciaInicio).getTime());
  }

  async getContrato(id: string): Promise<ContratoEntity | undefined> {
    const row = await this.prisma.tesourariaContrato.findFirst({
      where: { id, tenantId: this.tenantId() },
    });
    return row ? this.mapContrato(row) : undefined;
  }

  private mapFornecedor(row: {
    id: string;
    nome: string;
    cnpj: string;
    categoriaFornecedor: string;
    contato: string;
    prazoPagamentoPadrao: number;
    createdAt: Date;
  }): FornecedorEntity {
    return {
      id: row.id,
      nome: row.nome,
      cnpj: row.cnpj,
      categoriaFornecedor: row.categoriaFornecedor as FornecedorEntity['categoriaFornecedor'],
      contato: row.contato,
      prazoPagamentoPadrao: row.prazoPagamentoPadrao,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapDespesa(row: {
    id: string;
    fornecedor: string;
    categoria: string;
    descricao: string;
    valor: { toNumber(): number } | number;
    vencimento: Date;
    status: string;
    recorrencia: string;
    documentoReferencia: string | null;
    createdAt: Date;
  }): DespesaEntity {
    return {
      id: row.id,
      fornecedor: row.fornecedor,
      categoria: row.categoria as DespesaEntity['categoria'],
      descricao: row.descricao,
      valor: typeof row.valor === 'number' ? row.valor : row.valor.toNumber(),
      vencimento: row.vencimento.toISOString().slice(0, 10),
      status: row.status as DespesaEntity['status'],
      recorrencia: row.recorrencia as DespesaEntity['recorrencia'],
      documentoReferencia: row.documentoReferencia ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapContrato(row: {
    id: string;
    fornecedorId: string;
    tipoContrato: string;
    valorFixo: { toNumber(): number } | number;
    vigenciaInicio: Date;
    vigenciaFim: Date;
    reajusteAnualPct: { toNumber(): number } | number;
    observacoes: string | null;
    createdAt: Date;
  }): ContratoEntity {
    return {
      id: row.id,
      fornecedorId: row.fornecedorId,
      tipoContrato: row.tipoContrato as ContratoEntity['tipoContrato'],
      valorFixo: typeof row.valorFixo === 'number' ? row.valorFixo : row.valorFixo.toNumber(),
      vigenciaInicio: row.vigenciaInicio.toISOString().slice(0, 10),
      vigenciaFim: row.vigenciaFim.toISOString().slice(0, 10),
      reajusteAnualPct:
        typeof row.reajusteAnualPct === 'number' ? row.reajusteAnualPct : row.reajusteAnualPct.toNumber(),
      observacoes: row.observacoes ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
