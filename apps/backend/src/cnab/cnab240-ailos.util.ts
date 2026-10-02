import type { CnabLinhaRetorno } from './types/cnab.types';

/** Código 06 — Liquidação normal (pago). */
export const CNAB240_CODIGO_LIQUIDACAO = '06';

/** Posições CNAB 240 (1-based) — layout retorno Ailos/085. */
const POS = {
  segmento: 14,
  codigoMovimentoInicio: 16,
  codigoMovimentoFim: 17,
  nossoNumeroInicio: 38,
  nossoNumeroFim: 57,
  valorPagoInicio: 78,
  valorPagoFim: 92,
  dataOcorrenciaInicio: 138,
  dataOcorrenciaFim: 145,
} as const;

function slice1(linha: string, inicio: number, fim: number): string {
  return linha.substring(inicio - 1, fim);
}

export function parseValorCentavosCnab240(raw: string): number | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n)) return null;
  return Math.round(n) / 100;
}

export function parseDataCnab240DdMmYyyy(raw: string): Date | null {
  const d = raw.replace(/\D/g, '');
  if (d.length !== 8) return null;
  const dd = Number.parseInt(d.slice(0, 2), 10);
  const mm = Number.parseInt(d.slice(2, 4), 10);
  const yyyy = Number.parseInt(d.slice(4, 8), 10);
  if (!dd || !mm || !yyyy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

export function segmentoCnab240(linha: string): string {
  if (linha.length < POS.segmento) return '';
  return linha.charAt(POS.segmento - 1);
}

export function isHeaderArquivoAilos(linha: string): boolean {
  return linha.startsWith('08500000');
}

export function isHeaderLoteAilos(linha: string): boolean {
  return linha.startsWith('08500011');
}

/**
 * Extrai liquidações (código 06) do retorno CNAB 240 Ailos/085.
 * Segmento T + U consecutivos.
 */
export function parseCnab240AilosRetorno(conteudo: string): CnabLinhaRetorno[] {
  const rawLines = conteudo.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const out: CnabLinhaRetorno[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const linhaT = rawLines[i]!;

    if (isHeaderArquivoAilos(linhaT) || isHeaderLoteAilos(linhaT)) continue;
    if (segmentoCnab240(linhaT) !== 'T') continue;

    const codigoMovimento = slice1(linhaT, POS.codigoMovimentoInicio, POS.codigoMovimentoFim);
    if (codigoMovimento !== CNAB240_CODIGO_LIQUIDACAO) continue;

    const nossoNumero = slice1(linhaT, POS.nossoNumeroInicio, POS.nossoNumeroFim).trim();
    if (!nossoNumero) continue;

    const linhaU = rawLines[i + 1];
    if (!linhaU || segmentoCnab240(linhaU) !== 'U') continue;

    const valorPago = parseValorCentavosCnab240(
      slice1(linhaU, POS.valorPagoInicio, POS.valorPagoFim),
    );
    const dataPagamento = parseDataCnab240DdMmYyyy(
      slice1(linhaU, POS.dataOcorrenciaInicio, POS.dataOcorrenciaFim),
    );

    if (valorPago === null || !dataPagamento) continue;

    out.push({
      nossoNumero,
      valorPago,
      dataPagamento,
      codigoMovimento,
      ocorrencia: codigoMovimento,
    });

    i += 1;
  }

  return out;
}

/** Utilitário para testes — monta linha CNAB 240 (240 chars). */
export function buildCnab240Line(set: (write: (pos1: number, value: string) => void) => void): string {
  const chars = Array.from({ length: 240 }, () => ' ');
  const write = (pos1: number, value: string) => {
    for (let i = 0; i < value.length && pos1 - 1 + i < 240; i++) {
      chars[pos1 - 1 + i] = value[i]!;
    }
  };
  set(write);
  return chars.join('');
}
