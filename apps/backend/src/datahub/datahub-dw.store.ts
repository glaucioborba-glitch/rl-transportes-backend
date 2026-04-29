import { Injectable } from '@nestjs/common';
import type { NomeDim, NomeFato } from './datahub.types';

/** Fatos e dimensões materializados em memória após ETL `carregar`. */
@Injectable()
export class DatahubDwStore {
  fatos: Partial<Record<NomeFato, Record<string, unknown>[]>> = {};
  dimensoes: Partial<Record<NomeDim, Record<string, unknown>[]>> = {};
  ultimaCargaEm: string | null = null;

  substituir(fatos: DatahubDwStore['fatos'], dimensoes: DatahubDwStore['dimensoes']) {
    this.fatos = { ...fatos };
    this.dimensoes = { ...dimensoes };
    this.ultimaCargaEm = new Date().toISOString();
  }

  limpar() {
    this.fatos = {};
    this.dimensoes = {};
    this.ultimaCargaEm = null;
  }
}
