import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';

export type MobilePushTipo =
  | 'gate_autorizado'
  | 'container_chamado'
  | 'os_critica'
  | 'pagamento_confirmado'
  | 'nota_emitida'
  | 'alerta_risco_grc';

export interface MobilePushJob {
  id: string;
  tipo: MobilePushTipo;
  destinoSub?: string;
  deviceId?: string;
  titulo: string;
  corpo: string;
  meta?: Record<string, unknown>;
  criadoEm: string;
  entregueEm?: string;
}

@Injectable()
export class MobilePushStore {
  private readonly fila: MobilePushJob[] = [];
  private readonly fcmPorSub = new Map<string, string>();

  registrarFcm(sub: string, token: string) {
    this.fcmPorSub.set(sub, token.trim());
  }

  obterFcm(sub: string) {
    return this.fcmPorSub.get(sub);
  }

  enfileirar(p: Omit<MobilePushJob, 'id' | 'criadoEm'>): MobilePushJob {
    const j: MobilePushJob = { id: randomUUID(), criadoEm: new Date().toISOString(), ...p };
    this.fila.push(j);
    if (this.fila.length > 2000) this.fila.splice(0, 400);
    return j;
  }

  pendentesParaSub(sub: string) {
    return this.fila.filter((x) => !x.entregueEm && (x.destinoSub === sub || !x.destinoSub));
  }

  marcarEntregue(id: string) {
    const j = this.fila.find((x) => x.id === id);
    if (j) j.entregueEm = new Date().toISOString();
    return j;
  }

  listarUltimos(n = 50) {
    return [...this.fila].slice(-n).reverse();
  }
}
