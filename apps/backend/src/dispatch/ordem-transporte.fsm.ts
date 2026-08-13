import { BadRequestException } from '@nestjs/common';
import { StatusOrdemTransporte } from '@prisma/client';

const TRANSITIONS: Record<StatusOrdemTransporte, StatusOrdemTransporte[]> = {
  [StatusOrdemTransporte.PENDENTE]: [StatusOrdemTransporte.DESPACHADA],
  [StatusOrdemTransporte.DESPACHADA]: [StatusOrdemTransporte.EM_TRANSITO],
  [StatusOrdemTransporte.EM_TRANSITO]: [StatusOrdemTransporte.NO_LOCAL],
  [StatusOrdemTransporte.NO_LOCAL]: [StatusOrdemTransporte.CONCLUIDA],
  [StatusOrdemTransporte.CONCLUIDA]: [],
};

export function assertOrdemStatusTransition(
  current: StatusOrdemTransporte,
  next: StatusOrdemTransporte,
): void {
  const allowed = TRANSITIONS[current] ?? [];
  if (!allowed.includes(next)) {
    throw new BadRequestException(
      `Transição inválida: ${current} → ${next}. Sequência: DESPACHADA → EM_TRANSITO → NO_LOCAL → CONCLUIDA.`,
    );
  }
}

export function timestampFieldForStatus(
  status: StatusOrdemTransporte,
): 'dataDespacho' | 'dataInicio' | 'dataChegada' | 'dataConclusao' | null {
  switch (status) {
    case StatusOrdemTransporte.DESPACHADA:
      return 'dataDespacho';
    case StatusOrdemTransporte.EM_TRANSITO:
      return 'dataInicio';
    case StatusOrdemTransporte.NO_LOCAL:
      return 'dataChegada';
    case StatusOrdemTransporte.CONCLUIDA:
      return 'dataConclusao';
    default:
      return null;
  }
}
