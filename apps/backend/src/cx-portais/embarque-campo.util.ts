export const CAMPOS_EMBARQUE = [
  'booking',
  'processo',
  'navio',
  'localDestino',
  'dataAgendamento',
  'horaJanela',
] as const;
export type CampoEmbarque = (typeof CAMPOS_EMBARQUE)[number];

export const ALCANCES_EMBARQUE = ['unidade', 'processo', 'booking', 'navio'] as const;
export type AlcanceEmbarque = (typeof ALCANCES_EMBARQUE)[number];

export const LABEL_CAMPO_EMBARQUE: Record<CampoEmbarque, string> = {
  booking: 'Booking',
  processo: 'Processo',
  navio: 'Navio',
  localDestino: 'Local de destino',
  dataAgendamento: 'Data',
  horaJanela: 'Hora',
};

const HORA_RE = /^\d{2}:\d{2}$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isCampoEmbarque(value: unknown): value is CampoEmbarque {
  return CAMPOS_EMBARQUE.includes(String(value ?? '') as CampoEmbarque);
}

export function isAlcanceEmbarque(value: unknown): value is AlcanceEmbarque {
  return ALCANCES_EMBARQUE.includes(String(value ?? '') as AlcanceEmbarque);
}

export function formatHoraJanela(inicio?: string | null, fim?: string | null): string {
  const a = String(inicio ?? '').trim();
  const b = String(fim ?? '').trim();
  if (a && b) return `${a}-${b}`;
  return a || b || '';
}

export function parseHoraJanela(raw: unknown): { horaInicio: string | null; horaFim: string | null } {
  const compact = String(raw ?? '')
    .replace(/\s+/g, '')
    .replace('–', '-')
    .replace('—', '-');
  if (!compact) return { horaInicio: null, horaFim: null };
  const [inicio, fim] = compact.split('-');
  if (!HORA_RE.test(inicio ?? '') || !HORA_RE.test(fim ?? '')) {
    throw new Error('Hora inválida. Use o formato HH:mm-HH:mm.');
  }
  if ((fim ?? '') <= (inicio ?? '')) {
    throw new Error('O fim do agendamento deve ser depois do início.');
  }
  return { horaInicio: inicio, horaFim: fim };
}

export function ymdFromDate(value?: Date | string | null): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const ymd = value.slice(0, 10);
    return DATA_RE.test(ymd) ? ymd : '';
  }
  if (Number.isNaN(value.getTime())) return '';
  return value.toISOString().slice(0, 10);
}

/** Trim; booking/processo/navio teto 120, destino 255. Navio em maiúsculas. Vazio limpa. */
export function normalizeValorEmbarque(campo: CampoEmbarque, raw: unknown): string {
  if (campo === 'horaJanela') {
    const parsed = parseHoraJanela(raw);
    return formatHoraJanela(parsed.horaInicio, parsed.horaFim);
  }
  if (campo === 'dataAgendamento') {
    const ymd = String(raw ?? '')
      .trim()
      .slice(0, 10);
    if (!ymd) return '';
    if (!DATA_RE.test(ymd)) throw new Error('Data inválida. Use AAAA-MM-DD.');
    return ymd;
  }
  const teto = campo === 'localDestino' ? 255 : 120;
  const valor = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, teto);
  if (campo === 'navio') return valor.toUpperCase();
  return valor;
}

export function chaveAgrupamentoEmbarque(
  alcance: Exclude<AlcanceEmbarque, 'unidade'>,
  valor: unknown,
): string {
  const v = String(valor ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (alcance === 'navio') return v.toUpperCase();
  return v;
}

export function valoresBatemAlcance(
  alcance: Exclude<AlcanceEmbarque, 'unidade'>,
  chaveGrupo: string,
  valores: { booking?: string | null; processo?: string | null; navio?: string | null },
): boolean {
  if (!chaveGrupo) return false;
  return chaveAgrupamentoEmbarque(alcance, valores[alcance]) === chaveGrupo;
}

export type ContainerEmbarqueValores = {
  booking?: string | null;
  processo?: string | null;
  navio?: string | null;
  localDestino?: string | null;
  dataAgendamento?: Date | string | null;
  horaInicio?: string | null;
  horaFim?: string | null;
};

export function valorCampoEmbarque(container: ContainerEmbarqueValores, campo: CampoEmbarque): string {
  if (campo === 'booking') return String(container.booking ?? '').trim();
  if (campo === 'processo') return String(container.processo ?? '').trim();
  if (campo === 'navio') return String(container.navio ?? '').trim();
  if (campo === 'localDestino') return String(container.localDestino ?? '').trim();
  if (campo === 'dataAgendamento') return ymdFromDate(container.dataAgendamento);
  return formatHoraJanela(container.horaInicio, container.horaFim);
}

export function dataCampoEmbarque(
  campo: CampoEmbarque,
  valor: string,
):
  | { booking: string }
  | { processo: string }
  | { navio: string }
  | { localDestino: string | null }
  | { dataAgendamento: Date | null }
  | { horaInicio: string | null; horaFim: string | null } {
  if (campo === 'booking') return { booking: valor };
  if (campo === 'processo') return { processo: valor };
  if (campo === 'navio') return { navio: valor };
  if (campo === 'localDestino') return { localDestino: valor || null };
  if (campo === 'dataAgendamento') {
    return { dataAgendamento: valor ? new Date(`${valor}T12:00:00.000Z`) : null };
  }
  const parsed = parseHoraJanela(valor);
  return { horaInicio: parsed.horaInicio, horaFim: parsed.horaFim };
}
