import type { EstadoOperacionalIso } from './automacao.types';
import { transicaoEstadoPermitida, estadosAdjacentes } from './automacao-rule-engine';

export type EstadoContexto = {
  temPortaria: boolean;
  temGate: boolean;
  temPatio: boolean;
  temSaida: boolean;
};

/** Infere estado ISO mínimo a partir de flags (não altera banco). */
export function inferirEstadoOperacional(ctx: EstadoContexto): EstadoOperacionalIso {
  if (ctx.temSaida) return 'finalizado';
  if (ctx.temPatio) return 'patio';
  if (ctx.temGate) return 'gate-in';
  if (ctx.temPortaria) return 'portaria';
  return 'criado';
}

export function validarTransicaoIso(de: EstadoOperacionalIso, para: EstadoOperacionalIso): boolean {
  return transicaoEstadoPermitida(de, para);
}

export function listarGraficoEstados(): { estado: string; proximos: string[] }[] {
  const ordem: EstadoOperacionalIso[] = [
    'criado',
    'portaria',
    'gate-in',
    'patio',
    'gate-out',
    'finalizado',
  ];
  return ordem.map((e) => ({ estado: e, proximos: estadosAdjacentes(e) }));
}
