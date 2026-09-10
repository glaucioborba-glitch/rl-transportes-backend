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
  return [];
}

/** Energia reefer: faixas sobre dias conectados (sem free time). Dia 1 = primeiro dia ligado. */
export function calcularEnergiaEscalonada(diasConectados: number, faixas: FaixaDiaria[]): number {
  return calcularArmazenagemEscalonada(diasConectados, 0, faixas);
}

export function valorMedioEnergiaEscalonada(
  diasConectados: number,
  faixas: FaixaDiaria[],
): { total: number; diasConectados: number; valorMedio: number } {
  const total = calcularEnergiaEscalonada(diasConectados, faixas);
  const valorMedio = diasConectados > 0 ? roundMoney(total / diasConectados) : 0;
  return { total, diasConectados, valorMedio };
}

export function resolveFaixasEnergiaFromCadastroItem(item: {
  faixasEnergiaReefer?: unknown;
  tarifaEnergiaReeferDiaria?: number | null;
}): FaixaDiaria[] {
  const parsed = parseFaixasDiaria(item.faixasEnergiaReefer);
  if (parsed.length) return parsed;
  const flat = item.tarifaEnergiaReeferDiaria;
  if (flat != null && flat > 0) {
    return [{ diaInicio: 1, diaFim: null, valorDiaria: flat }];
  }
  return [];
}

export type FaixaCobrancaGrupo = {
  quantidade: number;
  valorUnitario: number;
};

/** Agrupa dias cobrados consecutivos com o mesmo valor (pula dia sem tarifa). */
export function agruparDiasPorFaixa(
  diaPrimeiro: number,
  diaUltimo: number,
  faixas: FaixaDiaria[],
  fator = 1,
): FaixaCobrancaGrupo[] {
  const grupos: FaixaCobrancaGrupo[] = [];
  for (let d = diaPrimeiro; d <= diaUltimo; d++) {
    const faixa = faixas.find(
      (f) => d >= f.diaInicio && (f.diaFim == null || d <= f.diaFim),
    );
    const valor = roundMoney((faixa?.valorDiaria ?? 0) * fator);
    if (valor <= 0) continue;
    const last = grupos[grupos.length - 1];
    if (last && last.valorUnitario === valor) last.quantidade += 1;
    else grupos.push({ quantidade: 1, valorUnitario: valor });
  }
  return grupos;
}

function formatBRL(valor: number): string {
  const [inteiro, decimal] = valor.toFixed(2).split('.');
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${comMilhar},${decimal}`;
}

/**
 * Ex.: "08 diárias de R$ 30,00 e 01 de R$ 45,00"
 * O substantivo só aparece no primeiro trecho (padrão de fatura).
 */
export function formatarFaixasCobranca(
  grupos: FaixaCobrancaGrupo[],
  substantivo: { singular: string; plural: string },
): string {
  if (!grupos.length) return '';
  const trechos = grupos.map((g, i) => {
    const qtd = String(g.quantidade).padStart(2, '0');
    const dinheiro = formatBRL(g.valorUnitario);
    if (i === 0) {
      const nome = g.quantidade === 1 ? substantivo.singular : substantivo.plural;
      return `${qtd} ${nome} de ${dinheiro}`;
    }
    return `${qtd} de ${dinheiro}`;
  });
  if (trechos.length === 1) return trechos[0];
  if (trechos.length === 2) return `${trechos[0]} e ${trechos[1]}`;
  return `${trechos.slice(0, -1).join(', ')} e ${trechos[trechos.length - 1]}`;
}

export const SUBSTANTIVO_DIARIA = { singular: 'diária', plural: 'diárias' } as const;
export const SUBSTANTIVO_DIA_ENERGIA = { singular: 'dia', plural: 'dias' } as const;

