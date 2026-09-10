import { CapacidadeVeiculoTerceiro } from '@prisma/client';
import { normalizePlate, onlyDigits } from '../common/utils/data-sanitize';
import { normalizeTamanhosContainer, TAMANHOS_CONTAINER_ORDEM } from './tipo-container-tamanhos.util';

const MAX_CARRETAS = 12;
const CAPACIDADES = new Set<string>(Object.values(CapacidadeVeiculoTerceiro));

export type CarretaTerceiroNorm = {
  placa: string;
  capacidade: CapacidadeVeiculoTerceiro;
  pinos: string[];
  renavam: string | null;
  validadeDocumento: string | null;
};

export function pinosFromCapacidade(
  cap: CapacidadeVeiculoTerceiro,
  catalogo: string[] = [...TAMANHOS_CONTAINER_ORDEM],
): string[] {
  if (cap === CapacidadeVeiculoTerceiro.PE_20) return catalogo.filter((t) => t === '20');
  if (cap === CapacidadeVeiculoTerceiro.PE_40) return catalogo.filter((t) => t === '40');
  return catalogo.length ? catalogo : [...TAMANHOS_CONTAINER_ORDEM];
}

export function capacidadeFromPinos(pinos: string[]): CapacidadeVeiculoTerceiro {
  if (pinos.length === 1 && pinos[0] === '20') return CapacidadeVeiculoTerceiro.PE_20;
  if (pinos.length === 1 && pinos[0] === '40') return CapacidadeVeiculoTerceiro.PE_40;
  return CapacidadeVeiculoTerceiro.AMBOS;
}

export function normalizePinosTerceiro(
  raw: unknown,
  fallbackCapacidade?: CapacidadeVeiculoTerceiro,
  catalogo: string[] = [...TAMANHOS_CONTAINER_ORDEM],
): string[] {
  const fromRaw = normalizeTamanhosContainer(raw).filter((t) => catalogo.includes(t));
  if (fromRaw.length) return fromRaw;
  if (fallbackCapacidade) return pinosFromCapacidade(fallbackCapacidade, catalogo);
  return [];
}

function asCapacidade(raw: unknown, fallback: CapacidadeVeiculoTerceiro): CapacidadeVeiculoTerceiro {
  const v = String(raw ?? '').toUpperCase();
  return CAPACIDADES.has(v) ? (v as CapacidadeVeiculoTerceiro) : fallback;
}

function asRenavam(raw: unknown): string | null {
  const d = onlyDigits(String(raw ?? ''));
  return d.length >= 9 && d.length <= 11 ? d : null;
}

function asValidadeIso(raw: unknown): string | null {
  const v = String(raw ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const dt = new Date(`${v}T12:00:00.000Z`);
  return Number.isNaN(dt.getTime()) ? null : v;
}

export function normalizeCarretasTerceiro(
  raw: unknown,
  fallbackPlacas: Array<string | null | undefined> = [],
  fallbackCapacidade: CapacidadeVeiculoTerceiro = CapacidadeVeiculoTerceiro.AMBOS,
): CarretaTerceiroNorm[] {
  const list = Array.isArray(raw)
    ? raw
    : fallbackPlacas.map((placa) => ({ placa, capacidade: fallbackCapacidade }));
  const out: CarretaTerceiroNorm[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const row =
      typeof item === 'string'
        ? { placa: item, capacidade: fallbackCapacidade, renavam: null, validadeDocumento: null }
        : item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : null;
    if (!row) continue;
    const placa = normalizePlate(String(row.placa ?? ''));
    if (placa.length < 6 || seen.has(placa)) continue;
    seen.add(placa);
    const capacidade = asCapacidade(row.capacidade, fallbackCapacidade);
    const pinos = normalizePinosTerceiro(row.pinos, capacidade);
    out.push({
      placa,
      capacidade: capacidadeFromPinos(pinos),
      pinos,
      renavam: asRenavam(row.renavam),
      validadeDocumento: asValidadeIso(row.validadeDocumento),
    });
    if (out.length >= MAX_CARRETAS) break;
  }
  return out;
}

export function resumoCapacidadeCarretas(carretas: CarretaTerceiroNorm[]): CapacidadeVeiculoTerceiro {
  const caps = [...new Set(carretas.map((c) => c.capacidade))];
  if (caps.length === 1) return caps[0];
  return CapacidadeVeiculoTerceiro.AMBOS;
}

export function normalizePlacasCarretas(
  raw: unknown,
  fallback: Array<string | null | undefined> = [],
): string[] {
  return normalizeCarretasTerceiro(raw, fallback).map((c) => c.placa);
}

export function parseIndiceDocumento(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n >= MAX_CARRETAS) return null;
  return n;
}
