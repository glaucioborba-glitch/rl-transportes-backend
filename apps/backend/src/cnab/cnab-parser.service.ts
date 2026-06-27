import { Injectable } from '@nestjs/common';
import { parseCnab240AilosRetorno } from './cnab240-ailos.util';
import type { CnabFormatoDetectado, CnabLinhaRetorno } from './types/cnab.types';

@Injectable()
export class CnabParserService {
  /**
   * Heurística por comprimento de linha (400 vs 240).
   */
  detectFormato(conteudo: string): CnabFormatoDetectado {
    const linhas = conteudo.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
    if (!linhas.length) return 'DESCONHECIDO';

    const counts = { cnab400: 0, cnab240: 0, ailos240: 0 };
    for (const linha of linhas.slice(0, 20)) {
      if (linha.startsWith('085')) counts.ailos240 += 1;
      const len = linha.length;
      if (len >= 394 && len <= 404) counts.cnab400 += 1;
      else if (len >= 234 && len <= 244) counts.cnab240 += 1;
    }

    if (counts.ailos240 > 0 || counts.cnab240 >= counts.cnab400) return 'CNAB240';
    if (counts.cnab400 > 0) return 'CNAB400';

    const firstLen = linhas[0]!.length;
    if (firstLen >= 394) return 'CNAB400';
    if (firstLen >= 234) return 'CNAB240';
    return 'DESCONHECIDO';
  }

  /** Stub — parsing CNAB 400 será implementado quando o layout for definido. */
  parseCnab400(_conteudo: string): CnabLinhaRetorno[] {
    return [];
  }

  /** Retorno CNAB 240 — Ailos (085): segmentos T/U, liquidação código 06. */
  parseCnab240(conteudo: string): CnabLinhaRetorno[] {
    return parseCnab240AilosRetorno(conteudo);
  }

  parseRetorno(conteudo: string): { formato: CnabFormatoDetectado; linhas: CnabLinhaRetorno[] } {
    const formato = this.detectFormato(conteudo);
    const linhas =
      formato === 'CNAB400'
        ? this.parseCnab400(conteudo)
        : formato === 'CNAB240'
          ? this.parseCnab240(conteudo)
          : conteudo.includes('085')
            ? this.parseCnab240(conteudo)
            : [];
    return { formato, linhas };
  }
}
