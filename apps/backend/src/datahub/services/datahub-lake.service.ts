import { Injectable } from '@nestjs/common';
import { LakeOrigem } from '../datahub.types';
import { DatahubLakeStore } from '../datahub-lake.store';

@Injectable()
export class DatahubLakeService {
  constructor(private readonly store: DatahubLakeStore) {}

  async ingest(origem: LakeOrigem, payload: Record<string, unknown>) {
    const rec = await this.store.ingestir(origem, payload);
    return {
      mensagem: 'Snapshot RAW aceito (gzip simulado).',
      arquivo: rec,
    };
  }

  async listarArquivos() {
    const arquivos = await this.store.listar();
    return {
      geradoEm: new Date().toISOString(),
      total: arquivos.length,
      arquivos,
    };
  }
}
