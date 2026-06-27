import { BadRequestException } from '@nestjs/common';
import { ContainerEventType, StatusAgendamentoTerminal } from '@prisma/client';
import {
  assertGateInCompleted,
  assertGateOutCompleted,
  countOcrFailures,
  hasPendingRepair,
} from './container-fsm.guards';
import type { ContainerEventRow } from './container-fsm.types';

const agendamento = {
  id: 'ag-1',
  numeroIso: 'ABCD1234567',
  clienteId: 'cli-1',
  status: StatusAgendamentoTerminal.CONFIRMADO,
};

describe('container-fsm.guards', () => {
  it('conta falhas OCR', () => {
    const events: ContainerEventRow[] = [
      { eventType: ContainerEventType.GATE_IN_OCR_FAILED, payload: {}, createdAt: new Date() },
      { eventType: ContainerEventType.GATE_IN_OCR_FAILED, payload: {}, createdAt: new Date() },
    ];
    expect(countOcrFailures(events)).toBe(2);
  });

  it('bloqueia gate-in sem QR e sem entrada manual', () => {
    expect(() =>
      assertGateInCompleted({}, [], agendamento, 'ABCD1234567', 'cli-1'),
    ).toThrow(BadRequestException);
  });

  it('permite gate-in com QR válido', () => {
    expect(() =>
      assertGateInCompleted(
        { agendamentoQrId: 'ag-1' },
        [],
        agendamento,
        'ABCD1234567',
        'cli-1',
      ),
    ).not.toThrow();
  });

  it('permite entrada manual após 2 falhas OCR', () => {
    const events: ContainerEventRow[] = [
      { eventType: ContainerEventType.GATE_IN_OCR_FAILED, payload: {}, createdAt: new Date() },
      { eventType: ContainerEventType.GATE_IN_OCR_FAILED, payload: {}, createdAt: new Date() },
    ];
    expect(() =>
      assertGateInCompleted(
        { manualEntry: true, placa: 'ABC1D23' },
        events,
        agendamento,
        'ABCD1234567',
        'cli-1',
      ),
    ).not.toThrow();
  });

  it('detecta reparo pendente sem aprovação subsequente', () => {
    const t1 = new Date('2026-06-01T10:00:00Z');
    const t2 = new Date('2026-06-02T10:00:00Z');
    const events: ContainerEventRow[] = [
      { eventType: ContainerEventType.REPAIR_REQUESTED, payload: {}, createdAt: t2 },
      { eventType: ContainerEventType.REPAIR_APPROVED, payload: {}, createdAt: t1 },
    ];
    expect(hasPendingRepair(events)).toBe(true);
    expect(() => assertGateOutCompleted(events)).toThrow(BadRequestException);
  });

  it('libera gate-out após reparo aprovado', () => {
    const t1 = new Date('2026-06-01T10:00:00Z');
    const t2 = new Date('2026-06-02T10:00:00Z');
    const events: ContainerEventRow[] = [
      { eventType: ContainerEventType.REPAIR_REQUESTED, payload: {}, createdAt: t1 },
      { eventType: ContainerEventType.REPAIR_APPROVED, payload: {}, createdAt: t2 },
    ];
    expect(hasPendingRepair(events)).toBe(false);
    expect(() => assertGateOutCompleted(events)).not.toThrow();
  });
});
