import { Injectable } from '@nestjs/common';
import { DW_CATALOGO_DIMENSOES, DW_CATALOGO_FATOS } from '../datahub-dw.catalog';
import { DatahubDwStore } from '../datahub-dw.store';
import type { NomeDim, NomeFato } from '../datahub.types';

@Injectable()
export class DatahubDwService {
  constructor(private readonly store: DatahubDwStore) {}

  async catalogoFatos() {
    await this.store.ensureFatosFresh();
    return {
      geradoEm: new Date().toISOString(),
      ultimaCargaEm: this.store.ultimaCargaEm,
      fonteFatos: 'postgresql_materialized_views',
      cacheL1TtlSec: 300,
      catalogo: DW_CATALOGO_FATOS,
      amostras: this.store.fatos,
    };
  }

  catalogoDimensoes() {
    return {
      geradoEm: new Date().toISOString(),
      ultimaCargaEm: this.store.ultimaCargaEm,
      catalogo: DW_CATALOGO_DIMENSOES,
      amostras: this.store.dimensoes,
    };
  }

  async obterFato(nome: NomeFato): Promise<Record<string, unknown>[]> {
    await this.store.ensureFatosFresh();
    return this.store.fatos[nome] ?? [];
  }

  obterDim(nome: NomeDim): Record<string, unknown>[] {
    return this.store.dimensoes[nome] ?? [];
  }
}
