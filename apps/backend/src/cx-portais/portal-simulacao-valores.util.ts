import { BadRequestException } from '@nestjs/common';
import { resolveTipoContainerCodigo } from '../cadastros/tipo-container-tamanhos.util';

/** Operações já cobertas pelo ciclo de armazenagem / gate — não entram como extra. */
export const OPERACOES_CORE_EXCLUIDAS = new Set([
  'ARMAZENAGEM',
  'BAIXA',
  'COLETA',
  'GATE_IN',
  'GATE_OUT',
  'HANDLING',
  'DIARIA_ARMAZENAGEM',
  'ENERGIA_REEFER',
  'SHIFTING_EXTRA',
]);

export const MAX_DATA_SAIDA_ANOS = 3;

export type OperacaoItemLike = {
  tipoOperacaoCodigo: string;
  tipoContainerCodigo: string | null;
  containerTamanho: string | null;
  valor: number;
  unidade: string;
};

export function normalizeOperacaoCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

export function isServicoAdicionalCodigo(codigo: string): boolean {
  const key = normalizeOperacaoCodigo(codigo);
  return Boolean(key) && !OPERACOES_CORE_EXCLUIDAS.has(key);
}

export function normalizeTamanhoPreco(value: string | null | undefined): string {
  if (!value || value === '*') return '';
  const digits = String(value).replace(/\D/g, '');
  return digits ? `${digits}'` : '';
}

export function tiposContainerParaMatch(tipo: string | null | undefined, refrigerado: boolean): string[] {
  const keys = new Set<string>();
  const raw = (tipo ?? '').trim().toUpperCase();
  if (raw) keys.add(raw);
  const resolved = resolveTipoContainerCodigo(raw);
  if (resolved) keys.add(resolved.toUpperCase());
  if (refrigerado) keys.add('REEFER');
  return [...keys];
}

export function scoreOperacaoItem(
  item: OperacaoItemLike,
  tipos: string[],
  tamanho: string,
): number {
  const itemTipo = (item.tipoContainerCodigo ?? '').trim().toUpperCase();
  let score = 0;
  if (itemTipo && itemTipo !== '*') {
    if (!tipos.includes(itemTipo)) return -1;
    score += 4;
  } else {
    score += 1;
  }

  const itemTam = normalizeTamanhoPreco(item.containerTamanho);
  if (itemTam) {
    if (tamanho && itemTam !== tamanho) return -1;
    if (tamanho && itemTam === tamanho) score += 2;
  } else {
    score += 1;
  }
  return score;
}

export function pickOperacaoItem<T extends OperacaoItemLike>(
  itens: T[],
  codigo: string,
  tipo: string | null | undefined,
  tamanhoRaw: string | null | undefined,
  refrigerado: boolean,
): T | null {
  const key = normalizeOperacaoCodigo(codigo);
  const candidates = itens.filter((i) => normalizeOperacaoCodigo(i.tipoOperacaoCodigo) === key);
  if (!candidates.length) return null;
  const tipos = tiposContainerParaMatch(tipo, refrigerado);
  const tamanho = normalizeTamanhoPreco(tamanhoRaw);
  const ranked = candidates
    .map((item) => ({ item, score: scoreOperacaoItem(item, tipos, tamanho) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.item ?? null;
}

/** Interpreta `YYYY-MM-DD` como fim do dia UTC (o dia de saída entra na estimativa). */
export function parseDataSaida(isoDate: string, now = new Date()): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) {
    throw new BadRequestException('Informe a data de saída no formato AAAA-MM-DD.');
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const asOf = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  if (Number.isNaN(asOf.getTime()) || asOf.getUTCFullYear() !== year || asOf.getUTCMonth() !== month - 1) {
    throw new BadRequestException('Data de saída inválida.');
  }
  const limite = new Date(now);
  limite.setUTCFullYear(limite.getUTCFullYear() + MAX_DATA_SAIDA_ANOS);
  if (asOf.getTime() > limite.getTime()) {
    throw new BadRequestException(`A data de saída não pode passar de ${MAX_DATA_SAIDA_ANOS} anos.`);
  }
  return asOf;
}

export function labelUnidadeCobranca(unidade: string): string {
  const u = unidade.trim().toUpperCase();
  if (u === 'POR_HORA') return 'por hora';
  if (u === 'POR_CICLO') return 'por ciclo';
  return 'por operação';
}
