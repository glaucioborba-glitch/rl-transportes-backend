import { TurnoAgendamento } from '@prisma/client';

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
