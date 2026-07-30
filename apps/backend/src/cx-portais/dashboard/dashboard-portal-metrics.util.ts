import { StatusSolicitacao, TipoUnidade } from '@prisma/client';

/** Limites operacionais por etapa (proxy BR-AG / tenant — minutos entre marcos). */
export type SlaMinutosOperacionais = {
  gate: number;
  patio: number;
  saida: number;
};

/** @deprecated use SlaMinutosOperacionais */
export type SlaHorasOperacionais = SlaMinutosOperacionais;

export function monthBoundsUtc(ref = new Date()): { start: Date; end: Date } {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

export function prevMonthBoundsUtc(ref = new Date()): { start: Date; end: Date } {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const firstThis = new Date(Date.UTC(y, m, 1));
  const lastPrev = new Date(firstThis.getTime() - 1);
  const y2 = lastPrev.getUTCFullYear();
  const m2 = lastPrev.getUTCMonth();
  const start = new Date(Date.UTC(y2, m2, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y2, m2 + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

export function decToNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (
    typeof v === 'object' &&
    v !== null &&
    'toNumber' in v &&
    typeof (v as { toNumber: () => number }).toNumber === 'function'
  ) {
    try {
      return (v as { toNumber: () => number }).toNumber();
    } catch {
      return 0;
    }
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function hoursBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / 3_600_000);
}

export function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / 60_000);
}

export type MarcoOperacional = {
  portaria?: { createdAt: Date } | null;
  gate?: { createdAt: Date } | null;
  patio?: { createdAt: Date } | null;
  saida?: { dataHoraSaida: Date } | null;
};

/**
 * Avalia cumprimento dos SLAs entre marcos consecutivos (portaria→gate→pátio→saída).
 * Trechos sem dados disponíveis são ignorados; sem trechos avaliáveis retorna null.
 */
export function avaliarSlaOperacional(
  createdAt: Date,
  marcos: MarcoOperacional,
  limites: SlaMinutosOperacionais,
): boolean | null {
  const p = marcos.portaria?.createdAt;
  const g = marcos.gate?.createdAt;
  const pt = marcos.patio?.createdAt;
  const sd = marcos.saida?.dataHoraSaida;

  const violacoes: boolean[] = [];

  if (p && g) {
    violacoes.push(minutesBetween(p, g) > limites.gate);
  } else if (!p && g) {
    violacoes.push(minutesBetween(createdAt, g) > limites.gate);
  }

  if (g && pt) {
    violacoes.push(minutesBetween(g, pt) > limites.patio);
  }

  if (pt && sd) {
    violacoes.push(minutesBetween(pt, sd) > limites.saida);
  }

  if (violacoes.length === 0) return null;
  return !violacoes.some(Boolean);
}

export function mapStatusCounts(
  rows: { status: StatusSolicitacao; _count: { _all: number } }[],
): {
  abertas: number;
  emAndamento: number;
  concluidas: number;
  canceladas: number;
  total: number;
} {
  let abertas = 0;
  let emAndamento = 0;
  let concluidas = 0;
  let canceladas = 0;
  let total = 0;
  for (const r of rows) {
    const n = r._count._all;
    total += n;
    switch (r.status) {
      case StatusSolicitacao.PENDENTE:
        abertas += n;
        break;
      case StatusSolicitacao.EM_ANALISE:
        abertas += n;
        break;
      case StatusSolicitacao.APROVADO:
        emAndamento += n;
        break;
      case StatusSolicitacao.EM_EXECUCAO:
        emAndamento += n;
        break;
      case StatusSolicitacao.AGUARDANDO_GATE_IN:
      case StatusSolicitacao.EM_PATIO:
      case StatusSolicitacao.AGUARDANDO_GATE_OUT:
        emAndamento += n;
        break;
      case StatusSolicitacao.CONCLUIDO:
        concluidas += n;
        break;
      case StatusSolicitacao.REJEITADO:
        canceladas += n;
        break;
      case StatusSolicitacao.CANCELADO:
        canceladas += n;
        break;
      default:
        break;
    }
  }
  return { abertas, emAndamento, concluidas, canceladas, total };
}

export function mapUnidadesPorTipo(
  rows: { tipo: TipoUnidade; _count: { _all: number } }[],
): {
  total: number;
  import: number;
  export: number;
  gateIn: number;
  gateOut: number;
} {
  const out = {
    total: 0,
    import: 0,
    export: 0,
    gateIn: 0,
    gateOut: 0,
  };
  for (const r of rows) {
    const n = r._count._all;
    out.total += n;
    switch (r.tipo) {
      case TipoUnidade.IMPORT:
        out.import += n;
        break;
      case TipoUnidade.EXPORT:
        out.export += n;
        break;
      case TipoUnidade.GATE_IN:
        out.gateIn += n;
        break;
      case TipoUnidade.GATE_OUT:
        out.gateOut += n;
        break;
      default:
        break;
    }
  }
  return out;
}

export function desempenhoPct(cumpridos: number, violados: number): number {
  const d = cumpridos + violados;
  if (d <= 0) return 100;
  return Math.round((100 * cumpridos) / d);
}
