import { ForbiddenException } from '@nestjs/common';
import { MobileOfflineSyncStore } from '../stores/mobile-offline-sync.store';
import { MobileTelemetryStore } from '../stores/mobile-telemetry.store';
import { MobileSyncService } from './mobile-sync.service';
import type { MobileRequestUser } from '../types/mobile-hub.types';

describe('MobileSyncService', () => {
  const operadorMock = { gateIn: jest.fn(), gateOut: jest.fn(), patioEvento: jest.fn(), registrarCanalLeve: jest.fn() };
  const motoristaMock = { checkin: jest.fn() };

  const operadorCx: MobileRequestUser = {
    sub: 'op1',
    email: 'op@test',
    mobileRole: 'OPERADOR_MOBILE',
    deviceId: 'd1',
    tv: 0,
    prismaUserId: 'op1',
    clienteId: null,
  };

  const motCx: MobileRequestUser = {
    sub: 'm1',
    email: 'm@test',
    mobileRole: 'MOTORISTA',
    deviceId: 'd2',
    tv: 0,
    clienteId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enfileira telemetria_batch para qualquer papel', () => {
    const store = new MobileOfflineSyncStore();
    const svc = new MobileSyncService(store, operadorMock as never, motoristaMock as never, new MobileTelemetryStore());
    const r = svc.enfileirar(motCx, 'telemetria_batch', { latenciaMsMedia: 12 }, Date.now());
    expect(r.op).toBe('telemetria_batch');
  });

  it('rejeita motorista enfileirando gate_in', () => {
    const svc = new MobileSyncService(
      new MobileOfflineSyncStore(),
      operadorMock as never,
      motoristaMock as never,
      new MobileTelemetryStore(),
    );
    expect(() => svc.enfileirar(motCx, 'gate_in', { protocolo: 'P1' }, Date.now())).toThrow(ForbiddenException);
  });

  it('rejeita operador enfileirando checkin_motorista', () => {
    const svc = new MobileSyncService(
      new MobileOfflineSyncStore(),
      operadorMock as never,
      motoristaMock as never,
      new MobileTelemetryStore(),
    );
    expect(() => svc.enfileirar(operadorCx, 'checkin_motorista', { protocolo: 'P1' }, Date.now())).toThrow(
      ForbiddenException,
    );
  });
});
