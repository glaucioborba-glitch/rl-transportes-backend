import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { digestBase64Payload } from '../../integracao-mobilidade/common/integracao-string.util';

export type MobileHubCanal = 'portaria' | 'gate_in' | 'gate_out' | 'patio' | 'incidente';

export interface MobileHubOpEntry {
  id: string;
  userId: string;
  canal: MobileHubCanal;
  protocolo?: string;
  recebidoEm: string;
  resumo: Record<string, unknown>;
}

@Injectable()
export class MobileHubOpsStore {
  private readonly ops: MobileHubOpEntry[] = [];

  add(p: {
    userId: string;
    canal: MobileHubCanal;
    protocolo?: string;
    imagemBase64?: string;
    extras?: Record<string, unknown>;
  }): MobileHubOpEntry {
    const digest = digestBase64Payload(p.imagemBase64);
    const e: MobileHubOpEntry = {
      id: randomUUID(),
      userId: p.userId,
      canal: p.canal,
      protocolo: p.protocolo,
      recebidoEm: new Date().toISOString(),
      resumo: { digest, ...p.extras },
    };
    this.ops.push(e);
    if (this.ops.length > 3000) this.ops.splice(0, 600);
    return e;
  }

  porUsuario(userId: string, limite = 40) {
    return this.ops.filter((o) => o.userId === userId).slice(-limite).reverse();
  }

  /** Leitura agregada NOC (Fase 22); mais recentes primeiro. */
  ultimos(n = 100): MobileHubOpEntry[] {
    return [...this.ops].slice(-n).reverse();
  }
}
