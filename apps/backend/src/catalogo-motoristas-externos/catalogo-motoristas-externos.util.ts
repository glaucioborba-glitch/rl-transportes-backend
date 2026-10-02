import { normalizeCpfDigits } from '../common/utils/data-sanitize';

export const CPF_FROTA_FL_PLACEHOLDER = '00000000000';
export const TZ_BRASIL = 'America/Sao_Paulo';
/** Prazo “indefinido”: não entra na liberação automática. */
export const SUSPENSAO_INDEFINIDA_ATE = new Date('2099-12-31T23:59:59.999-03:00');

export const MSG_MOTORISTA_INDISPONIVEL_PORTAL =
  'Não foi possível incluir este motorista nesta solicitação. Informe outro CPF ou fale com o terminal.';

export function normalizeMotoristaCpf(value: unknown): string {
  return normalizeCpfDigits(String(value ?? ''));
}

export function isCpfFrotaPlaceholder(cpf: string): boolean {
  return normalizeMotoristaCpf(cpf) === CPF_FROTA_FL_PLACEHOLDER;
}

export function ymdSaoPaulo(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ_BRASIL });
}

export function endOfSaoPauloDay(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999-03:00`);
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00.000-03:00`);
  d.setDate(d.getDate() + days);
  return ymdSaoPaulo(d);
}

export function parseInicioYmd(inicio?: string, now = new Date()): Date {
  const ymd = inicio?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(inicio.trim()) ? inicio.trim() : ymdSaoPaulo(now);
  return new Date(`${ymd}T00:00:00.000-03:00`);
}

export function motoristaEstaSuspenso(suspensoAte?: Date | null, now = new Date()): boolean {
  return Boolean(suspensoAte && suspensoAte.getTime() > now.getTime());
}

export function suspensaoEhIndefinida(suspensoAte?: Date | null, suspensaoDias?: number | null): boolean {
  if (!suspensoAte) return false;
  if (suspensaoDias == null) return suspensoAte.getUTCFullYear() >= 2099;
  return false;
}

export function suspensoAteEm(dias: number, inicio = new Date()): Date {
  const d = Math.min(365, Math.max(1, Math.round(dias)));
  const startYmd = ymdSaoPaulo(inicio);
  return endOfSaoPauloDay(addDaysYmd(startYmd, d));
}

/** Dias civis em Brasília até o fim do bloqueio (0 = encerra hoje). */
export function diasRestantesSuspensao(suspensoAte?: Date | null, now = new Date()): number | null {
  if (!suspensoAte || !motoristaEstaSuspenso(suspensoAte, now)) return null;
  if (suspensaoEhIndefinida(suspensoAte)) return null;
  const a = ymdSaoPaulo(now);
  const b = ymdSaoPaulo(suspensoAte);
  const start = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const end = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.max(0, Math.round((end - start) / 86_400_000));
}
