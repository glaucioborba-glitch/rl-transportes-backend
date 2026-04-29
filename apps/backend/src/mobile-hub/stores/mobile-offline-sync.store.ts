import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';

export type OfflineOpType =
  | 'gate_in'
  | 'gate_out'
  | 'patio'
  | 'portaria'
  | 'checkin_motorista'
  | 'telemetria_batch';

export interface OfflineEventRecord {
  id: string;
  deviceId: string;
  userSub: string;
  op: OfflineOpType;
  body: Record<string, unknown>;
  clientTs: number;
  recebidoEm: string;
  synced: boolean;
  conflictResolved?: string;
}

/** Fila offline + LWW por (userSub, op, chave). */
@Injectable()
export class MobileOfflineSyncStore {
  private readonly events: OfflineEventRecord[] = [];

  enfileirar(e: Omit<OfflineEventRecord, 'id' | 'recebidoEm' | 'synced' | 'conflictResolved'>): OfflineEventRecord {
    const rec: OfflineEventRecord = {
      id: randomUUID(),
      recebidoEm: new Date().toISOString(),
      synced: false,
      ...e,
    };
    this.events.push(rec);
    if (this.events.length > 5000) this.events.splice(0, 1000);
    return rec;
  }

  listarPendentes(deviceId: string): OfflineEventRecord[] {
    return this.events.filter((x) => x.deviceId === deviceId && !x.synced);
  }

  marcarSincronizado(ids: string[]) {
    const set = new Set(ids);
    for (const e of this.events) {
      if (set.has(e.id)) e.synced = true;
    }
  }

  /** LWW: mantém evento com maior clientTs por chave composta. */
  resolverLww(grupo: OfflineEventRecord[]): OfflineEventRecord {
    return grupo.reduce((a, b) => (a.clientTs >= b.clientTs ? a : b));
  }

  ultimos(n = 100) {
    return [...this.events].slice(-n).reverse();
  }
}
