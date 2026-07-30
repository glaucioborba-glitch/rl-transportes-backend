import { roundMoney } from '../armazenagem-faturamento/armazenagem-billing.util';
import type { FaixaDiaria } from './faixa-diaria.types';
import { parseFaixasDiaria } from './faixa-diaria.types';

/**
 * Calcula armazenagem escalonada por faixas de permanência.
 * diasPermanencia: dias corridos no pátio (inclusive dia de chegada como dia 1).
 * freeTimeDias: primeiros N dias isentos (ex.: 7 = dias 1..7 free).
 */
export function calcularArmazenagemEscalonada(
  diasPermanencia: number,
  freeTimeDias: number,
  faixas: FaixaDiaria[],
): number {
  if (diasPermanencia <= freeTimeDias || !faixas.length) return 0;

  let total = 0;
  for (let d = freeTimeDias + 1; d <= diasPermanencia; d++) {
    const faixa = faixas.find(
      (f) => d >= f.diaInicio && (f.diaFim == null || d <= f.diaFim),
    );
    total += faixa?.valorDiaria ?? 0;
  }
  return roundMoney(total);
}

/** Valor médio por dia faturável (para exibição em linha de item). */
export function valorMedioDiariaEscalonada(
  diasPermanencia: number,
  freeTimeDias: number,
  faixas: FaixaDiaria[],
): { total: number; diasFaturaveis: number; valorMedio: number } {
  const diasFaturaveis = Math.max(0, diasPermanencia - freeTimeDias);
  const total = calcularArmazenagemEscalonada(diasPermanencia, freeTimeDias, faixas);
  const valorMedio =
    diasFaturaveis > 0 ? roundMoney(total / diasFaturaveis) : 0;
  return { total, diasFaturaveis, valorMedio };
}

/** Faixas padrão quando cadastro não define (8-15 @ 30, 16+ @ 45). */
export const FAIXAS_DIARIA_PADRAO: FaixaDiaria[] = [
  { diaInicio: 8, diaFim: 15, valorDiaria: 30 },
  { diaInicio: 16, diaFim: null, valorDiaria: 45 },
];

export function resolveFaixasFromCadastroItem(item: {
  faixasDiaria?: unknown;
  tarifaDiariaArmazenagem?: number | null;
  freeTimeDias?: number | null;
}): FaixaDiaria[] {
  const parsed = parseFaixasDiaria(item.faixasDiaria);
  if (parsed.length) return parsed;
  const flat = item.tarifaDiariaArmazenagem;
  if (flat != null && flat > 0) {
    const start = (item.freeTimeDias ?? 0) + 1;
    return [{ diaInicio: start, diaFim: null, valorDiaria: flat }];
  }
  return FAIXAS_DIARIA_PADRAO;
}
