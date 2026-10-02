export const RH_AGENDA_TIPOS = [
  'ANIVERSARIO_COLABORADOR',
  'ANIVERSARIO_DEPENDENTE',
  'CONTRATO_EXPERIENCIA',
  'AVALIACAO_EXPERIENCIA',
  'NR',
  'CURSO_REACH_STACKER',
  'CNH',
] as const;

export type RhAgendaTipo = (typeof RH_AGENDA_TIPOS)[number];

export type RhAgendaUrgencia = 'vencido' | 'hoje' | 'proximo' | 'atencao' | 'agenda';

export type RhAgendaNrItem = {
  codigo?: string;
  validade?: string;
};

export type RhAgendaEvento = {
  id: string;
  tipo: RhAgendaTipo;
  data: string;
  titulo: string;
  descricao: string;
  colaboradorId: string;
  colaboradorNome: string;
  cargo: string | null;
  departamento: string | null;
  dias: number;
  urgencia: RhAgendaUrgencia;
};

const NR_LABELS: Record<string, string> = {
  'NR-05': 'CIPA',
  'NR-06': 'EPI',
  'NR-11': 'Movimentação / empilhadeiras',
  'NR-12': 'Segurança em máquinas',
  'NR-17': 'Ergonomia',
  'NR-20': 'Inflamáveis',
  'NR-23': 'Brigada / incêndio',
  'NR-33': 'Espaços confinados',
  'NR-35': 'Trabalho em altura',
};

export function nrLabel(codigo: string): string {
  const key = codigo.trim().toUpperCase();
  return NR_LABELS[key] ? `${key} — ${NR_LABELS[key]}` : key;
}

export function todayYmd(hoje = new Date()): string {
  return toYmdUtc(hoje) ?? '1970-01-01';
}

export function toYmdUtc(value: Date | string | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  const y = value.getUTCFullYear();
  const mo = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return toYmdUtc(dt)!;
}

export function diffDaysYmd(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ty, tm, td] = toYmd.split('-').map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Próxima ocorrência (aniversário) a partir de hoje, inclusive. */
export function nextOccurrenceYmd(origemYmd: string, today: string): string {
  const [, mm, ddRaw] = origemYmd.split('-');
  const month = Number(mm);
  const origDay = Number(ddRaw);

  const clampDay = (year: number) => {
    if (month === 2 && origDay === 29 && !isLeapYear(year)) return 28;
    return origDay;
  };

  let year = Number(today.slice(0, 4));
  let next = `${year}-${mm}-${String(clampDay(year)).padStart(2, '0')}`;
  if (next < today) {
    year += 1;
    next = `${year}-${mm}-${String(clampDay(year)).padStart(2, '0')}`;
  }
  return next;
}

export function urgenciaDeDias(dias: number): RhAgendaUrgencia {
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'hoje';
  if (dias <= 7) return 'proximo';
  if (dias <= 30) return 'atencao';
  return 'agenda';
}

export function inWindow(dataYmd: string, today: string, diasFrente: number, diasAtras: number): boolean {
  const d = diffDaysYmd(today, dataYmd);
  return d >= -diasAtras && d <= diasFrente;
}

export function parseNrs(raw: unknown): RhAgendaNrItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const codigo = typeof rec.codigo === 'string' ? rec.codigo.trim() : '';
      const validade = toYmdUtc(
        typeof rec.validade === 'string' || rec.validade instanceof Date ? rec.validade : null,
      );
      if (!codigo || !validade) return null;
      return { codigo, validade };
    })
    .filter((x): x is RhAgendaNrItem & { codigo: string; validade: string } => Boolean(x));
}
