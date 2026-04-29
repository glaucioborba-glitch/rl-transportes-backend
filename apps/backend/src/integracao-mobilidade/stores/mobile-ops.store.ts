import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type MobileCanal = 'portaria' | 'gate' | 'patio' | 'saida';

export interface MobileOpEntry {
  id: string;
  userId: string;
  canal: MobileCanal;
  payload: Record<string, unknown>;
  /** Base64 truncado para observabilidade (payload completo não é persistido em disco nesta fase). */
  payloadDigest: string;
  receivedAt: string;
}

const MAX = 200;

@Injectable()
export class MobileOpsStore {
  private ops: MobileOpEntry[] = [];

  add(entry: Omit<MobileOpEntry, 'id' | 'receivedAt'>): MobileOpEntry {
    const full: MobileOpEntry = {
      ...entry,
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
    };
    this.ops.push(full);
    if (this.ops.length > MAX) this.ops = this.ops.slice(-MAX);
    return full;
  }

  byUser(userId: string): MobileOpEntry[] {
    return this.ops.filter((o) => o.userId === userId).reverse();
  }
}
