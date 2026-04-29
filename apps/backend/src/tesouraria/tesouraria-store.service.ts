import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  ContratoEntity,
  DespesaEntity,
  FornecedorEntity,
} from './tesouraria.domain';

@Injectable()
export class TesourariaStoreService {
  private fornecedores = new Map<string, FornecedorEntity>();
  private despesas = new Map<string, DespesaEntity>();
  private contratos = new Map<string, ContratoEntity>();

  createFornecedor(input: Omit<FornecedorEntity, 'id' | 'createdAt'>): FornecedorEntity {
    const id = randomUUID();
    const e: FornecedorEntity = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
    };
    this.fornecedores.set(id, e);
    return e;
  }

  listFornecedores(): FornecedorEntity[] {
    return [...this.fornecedores.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR'),
    );
  }

  getFornecedor(id: string): FornecedorEntity | undefined {
    return this.fornecedores.get(id);
  }

  createDespesa(input: Omit<DespesaEntity, 'id' | 'createdAt'>): DespesaEntity {
    const id = randomUUID();
    const e: DespesaEntity = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
    };
    this.despesas.set(id, e);
    return e;
  }

  listDespesas(): DespesaEntity[] {
    return [...this.despesas.values()].sort(
      (a, b) => new Date(b.vencimento).getTime() - new Date(a.vencimento).getTime(),
    );
  }

  getDespesa(id: string): DespesaEntity | undefined {
    return this.despesas.get(id);
  }

  createContrato(input: Omit<ContratoEntity, 'id' | 'createdAt'>): ContratoEntity {
    const id = randomUUID();
    const e: ContratoEntity = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
    };
    this.contratos.set(id, e);
    return e;
  }

  listContratos(): ContratoEntity[] {
    return [...this.contratos.values()].sort(
      (a, b) => new Date(a.vigenciaInicio).getTime() - new Date(b.vigenciaInicio).getTime(),
    );
  }

  getContrato(id: string): ContratoEntity | undefined {
    return this.contratos.get(id);
  }
}
