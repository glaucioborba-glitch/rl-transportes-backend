import { normalizeCpfDigits } from '../common/utils/data-sanitize';

export const CPF_FROTA_FL_PLACEHOLDER = '00000000000';

export function normalizeMotoristaCpf(value: unknown): string {
  return normalizeCpfDigits(String(value ?? ''));
}

export function isCpfFrotaPlaceholder(cpf: string): boolean {
  return normalizeMotoristaCpf(cpf) === CPF_FROTA_FL_PLACEHOLDER;
}

export function motoristaEstaSuspenso(suspensoAte?: Date | null, now = new Date()): boolean {
  return Boolean(suspensoAte && suspensoAte.getTime() > now.getTime());
}

export function suspensoAteEm(dias: number, now = new Date()): Date {
  const d = Math.min(365, Math.max(1, Math.round(dias)));
  const ate = new Date(now);
  ate.setDate(ate.getDate() + d);
  ate.setHours(23, 59, 59, 999);
  return ate;
}
