import { Injectable } from '@nestjs/common';
import { DW_CATALOGO_DIMENSOES, DW_CATALOGO_FATOS } from '../datahub-dw.catalog';
import { DatahubDwStore } from '../datahub-dw.store';
import type { NomeDim, NomeFato } from '../datahub.types';

@Injectable()
export class DatahubDwService {
  constructor(private readonly store: DatahubDwStore) {}

  catalogoFatos() {
    return {
      geradoEm: new Date().toISOString(),
      ultimaCargaEm: this.store.ultimaCargaEm,
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

  obterFato(nome: NomeFato): Record<string, unknown>[] {
    return this.store.fatos[nome] ?? [];
  }

  obterDim(nome: NomeDim): Record<string, unknown>[] {
    return this.store.dimensoes[nome] ?? [];
  }
}
