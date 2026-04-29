import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { IntegracaoTipoEvento } from '../integracao-events.constants';

export interface IntegracaoEventLogEntry {
  id: string;
  tipo: IntegracaoTipoEvento;
  payload: Record<string, unknown>;
  clienteId?: string;
  correlationId?: string;
  at: string;
}

const MAX = 500;

@Injectable()
export class IntegracaoEventLogStore {
  private entries: IntegracaoEventLogEntry[] = [];

  push(e: Omit<IntegracaoEventLogEntry, 'at' | 'id'>): IntegracaoEventLogEntry {
    const full: IntegracaoEventLogEntry = {
      ...e,
      id: randomUUID(),
      at: new Date().toISOString(),
    };
    this.entries.push(full);
    if (this.entries.length > MAX) this.entries = this.entries.slice(-MAX);
    return full;
  }

  recent(clienteId?: string, limit = 50): IntegracaoEventLogEntry[] {
    let rows = [...this.entries].reverse();
    if (clienteId) rows = rows.filter((x) => x.clienteId === clienteId);
    return rows.slice(0, limit);
  }
}
