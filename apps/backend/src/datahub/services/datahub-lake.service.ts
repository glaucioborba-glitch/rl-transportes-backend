import { Injectable } from '@nestjs/common';
import { LakeOrigem } from '../datahub.types';
import { DatahubLakeStore } from '../datahub-lake.store';

@Injectable()
export class DatahubLakeService {
  constructor(private readonly store: DatahubLakeStore) {}

  ingest(origem: LakeOrigem, payload: Record<string, unknown>) {
    const rec = this.store.ingestir(origem, payload);
    return {
      mensagem: 'Snapshot RAW aceito (gzip simulado).',
      arquivo: rec,
    };
  }

  listarArquivos() {
    return {
      geradoEm: new Date().toISOString(),
      total: this.store.arquivos.length,
      arquivos: this.store.listar(),
    };
  }
}
