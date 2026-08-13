import { TurnoAgendamento } from '@prisma/client';
import type { TenantTurnoOperacionalConfig } from '../tenant/tenant-config.types';

const DIA_SEMANA_MAP = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'] as const;

/** Limite do turno da manhã — default 12h local (config: TURNO_MEIO_DIA_HORA). */
export function turnoAtual(
  ref = new Date(),
  boundaryHour = Math.min(
    23,
    Math.max(0, parseInt(process.env.TURNO_MEIO_DIA_HORA || '12', 10) || 12),
  ),
): TurnoAgendamento {
  return ref.getHours() < boundaryHour ? TurnoAgendamento.MANHA : TurnoAgendamento.TARDE;
}

export function diaSemanaCodigo(ref: Date): string {
  return DIA_SEMANA_MAP[ref.getUTCDay()] ?? 'SEG';
}

export function isFimDeSemana(ref: Date): boolean {
  const d = ref.getUTCDay();
  return d === 0 || d === 6;
}

/** Resolve config de turno por slot (MANHA/TARDE) + dia da semana. */
export function resolveTurnoConfig(
  turnos: TenantTurnoOperacionalConfig[],
  dataRef: Date,
  slot: TurnoAgendamento,
): TenantTurnoOperacionalConfig | undefined {
  const dia = diaSemanaCodigo(dataRef);
  return turnos.find(
    (t) =>
      t.ativo &&
      t.diasSemana.includes(dia) &&
      (t.slot === slot || t.codigo === slot),
  );
}

/** Resolve turno atual a partir da configuração operacional (fallback: turnoAtual). */
export function turnoAtualFromConfig(
  turnos: TenantTurnoOperacionalConfig[],
  ref = new Date(),
): TurnoAgendamento {
  const slot = turnoAtual(ref);
  const match = resolveTurnoConfig(turnos, ref, slot);
  return match ? slot : turnoAtual(ref);
}

export function parseHoraMinutos(hora: string): number {
  const [h, m] = hora.split(':').map((v) => parseInt(v, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

export function horaDentroDoTurno(hora: string, inicio: string, fim: string): boolean {
  const h = parseHoraMinutos(hora);
  const i = parseHoraMinutos(inicio);
  const f = parseHoraMinutos(fim);
  return h >= i && h < f;
}
