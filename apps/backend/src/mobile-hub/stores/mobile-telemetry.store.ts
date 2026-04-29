import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';

export type MobileTelemetryBatch = {
  id: string;
  deviceId: string;
  userSub: string;
  mobileRole: string;
  localizacao?: { lat: number; lng: number; precisaoM?: number };
  redeForca?: number;
  latenciaMsMedia?: number;
  errosRecorrentes?: string[];
  usoOffline?: boolean;
  recebidoEm: string;
};

@Injectable()
export class MobileTelemetryStore {
  private readonly batches: MobileTelemetryBatch[] = [];

  registrar(b: Omit<MobileTelemetryBatch, 'id' | 'recebidoEm'>): MobileTelemetryBatch {
    const x: MobileTelemetryBatch = {
      id: randomUUID(),
      recebidoEm: new Date().toISOString(),
      ...b,
    };
    this.batches.push(x);
    if (this.batches.length > 8000) this.batches.splice(0, 2000);
    return x;
  }

  agregadoStaff() {
    const corte = Date.now() - 24 * 3600 * 1000;
    const recent = this.batches.filter((b) => new Date(b.recebidoEm).getTime() >= corte);
    const offline = recent.filter((b) => b.usoOffline).length;
    const lat = recent.filter((b) => b.latenciaMsMedia != null).map((b) => b.latenciaMsMedia!);
    const latMedia = lat.length ? lat.reduce((a, b) => a + b, 0) / lat.length : null;
    return {
      janelaHoras: 24,
      batches: recent.length,
      usoOfflinePct: recent.length ? Math.round((offline / recent.length) * 100) : 0,
      latenciaMsMedia: latMedia != null ? Math.round(latMedia) : null,
      dispositivosUnicosProxy: new Set(recent.map((b) => b.deviceId)).size,
    };
  }

  ultimosJanela(n = 200): MobileTelemetryBatch[] {
    return [...this.batches].slice(-n).reverse();
  }
}
