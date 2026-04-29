import { Injectable } from '@nestjs/common';
import type { ExtratoLinhaNormalizada } from './extrato-parser';

export interface ExtratoLoteArmazenado {
  batchId: string;
  formato: 'OFX' | 'CSV' | 'API';
  nomeOrigem?: string;
  importadoEm: Date;
  linhas: ExtratoLinhaNormalizada[];
}

/**
 * Armazenamento em memória dos extratos normalizados (Fase 9 sem migration).
 * Reinicia com o processo; substituir por persistência PostgreSQL quando houver tabela.
 */
@Injectable()
export class ExtratoStoreService {
  private readonly lotes = new Map<string, ExtratoLoteArmazenado>();
  /** Conciliação manual: idLinha extrato → vínculos forçados */
  private readonly manualPorLinha = new Map<string, { boletoId: string; faturamentoId: string }>();

  salvarLote(
    batchId: string,
    linhas: ExtratoLinhaNormalizada[],
    formato: ExtratoLoteArmazenado['formato'],
    nomeOrigem?: string,
  ): string {
    const armazenado: ExtratoLoteArmazenado = {
      batchId,
      formato,
      nomeOrigem,
      importadoEm: new Date(),
      linhas,
    };
    this.lotes.set(batchId, armazenado);
    return batchId;
  }

  listarLotes(): ExtratoLoteArmazenado[] {
    return [...this.lotes.values()].sort((a, b) => b.importadoEm.getTime() - a.importadoEm.getTime());
  }

  getLote(batchId: string): ExtratoLoteArmazenado | undefined {
    return this.lotes.get(batchId);
  }

  todasLinhas(batchId?: string): ExtratoLinhaNormalizada[] {
    if (batchId) {
      return [...(this.lotes.get(batchId)?.linhas ?? [])];
    }
    const out: ExtratoLinhaNormalizada[] = [];
    for (const l of this.lotes.values()) {
      out.push(...l.linhas);
    }
    return out;
  }

  registrarManual(linhaId: string, boletoId: string, faturamentoId: string): void {
    this.manualPorLinha.set(linhaId, { boletoId, faturamentoId });
  }

  getManualMap(): Map<string, { boletoId: string; faturamentoId: string }> {
    return new Map(this.manualPorLinha);
  }
}
