/** Buckets de turno para métricas de auditoria (hora local do servidor / UTC consistente). */

export enum TurnoPlanejamentoPessoal {
  MANHA = 'MANHA',
  TARDE = 'TARDE',
  NOITE = 'NOITE',
}

export function horaParaTurno(hourRaw: number): TurnoPlanejamentoPessoal {
  const h = ((Math.floor(hourRaw) % 24) + 24) % 24;
  if (h >= 6 && h < 13) return TurnoPlanejamentoPessoal.MANHA;
  if (h >= 13 && h < 21) return TurnoPlanejamentoPessoal.TARDE;
  return TurnoPlanejamentoPessoal.NOITE;
}

/** Horas “cheias” por turno para proxy operador-hora (turnos solapados ~8h). */
export function horasTurnoReferencia(turno: TurnoPlanejamentoPessoal): number {
  switch (turno) {
    case TurnoPlanejamentoPessoal.MANHA:
      return 8;
    case TurnoPlanejamentoPessoal.TARDE:
      return 8;
    default:
      return 9;
  }
}
