import { BadRequestException } from '@nestjs/common';
import {
  ContainerEventType,
  StatusAgendamentoTerminal,
  TipoContainerTos,
} from '@prisma/client';
import type { ContainerEventRow } from './container-fsm.types';

export type AgendamentoContext = {
  id: string;
  numeroIso: string;
  clienteId: string;
  status: StatusAgendamentoTerminal;
};

export type GateInPayload = {
  manualEntry?: boolean;
  agendamentoQrId?: string;
  ocrAttempt?: number;
  placa?: string;
  numeroContainer?: string;
};

export type RepairApprovalOrigin = 'CLIENTE_PORTAL' | 'STAFF_INTRANET';

export function countOcrFailures(events: ContainerEventRow[]): number {
  return events.filter((e) => e.eventType === ContainerEventType.GATE_IN_OCR_FAILED).length;
}

export function hasPendingRepair(events: ContainerEventRow[]): boolean {
  let lastRepairRequested: Date | null = null;
  let lastRepairApproved: Date | null = null;
  for (const ev of events) {
    if (ev.eventType === ContainerEventType.REPAIR_REQUESTED) {
      lastRepairRequested = ev.createdAt;
    }
    if (ev.eventType === ContainerEventType.REPAIR_APPROVED) {
      lastRepairApproved = ev.createdAt;
    }
  }
  if (!lastRepairRequested) return false;
  if (!lastRepairApproved) return true;
  return lastRepairApproved.getTime() < lastRepairRequested.getTime();
}

export function assertGateInCompleted(
  payload: GateInPayload,
  events: ContainerEventRow[],
  agendamento: AgendamentoContext,
  containerNumero: string,
  containerClienteId: string,
): void {
  const ocrFailures = countOcrFailures(events);

  if (payload.manualEntry) {
    if (ocrFailures < 2) {
      throw new BadRequestException(
        'Entrada manual só é permitida após 2 falhas de OCR registradas (GATE_IN_OCR_FAILED).',
      );
    }
    if (!payload.placa?.trim() && !payload.numeroContainer?.trim()) {
      throw new BadRequestException(
        'Entrada manual exige placa ou número do contêiner no payload.',
      );
    }
    return;
  }

  const qrId = payload.agendamentoQrId?.trim();
  if (!qrId) {
    throw new BadRequestException(
      'Gate-In exige agendamentoQrId válido (QR Code) ou entrada manual após 2 falhas de OCR.',
    );
  }
  if (qrId !== agendamento.id) {
    throw new BadRequestException('QR Code do agendamento não confere com o contêiner.');
  }
  if (agendamento.status === StatusAgendamentoTerminal.CANCELADO) {
    throw new BadRequestException('Agendamento cancelado — gate-in não permitido.');
  }
  if (agendamento.numeroIso.replace(/\s/g, '').toUpperCase() !== containerNumero.replace(/\s/g, '').toUpperCase()) {
    throw new BadRequestException('Número ISO do agendamento não confere com o contêiner.');
  }
  if (agendamento.clienteId !== containerClienteId) {
    throw new BadRequestException('Cliente do agendamento não confere com o contêiner.');
  }
}

export function assertGateOutCompleted(events: ContainerEventRow[]): void {
  if (hasPendingRepair(events)) {
    throw new BadRequestException(
      'Gate-Out bloqueado: existe reparo pendente de aprovação (REPAIR_REQUESTED sem REPAIR_APPROVED subsequente).',
    );
  }
}

export function assertReeferPlugged(tipo: TipoContainerTos): void {
  if (tipo !== TipoContainerTos.REEFER) {
    throw new BadRequestException('REEFER_PLUGGED só se aplica a contêineres REEFER.');
  }
}

export function assertReeferUnplugged(tipo: TipoContainerTos): void {
  if (tipo !== TipoContainerTos.REEFER) {
    throw new BadRequestException('REEFER_UNPLUGGED só se aplica a contêineres REEFER.');
  }
}
