import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { IntegracaoTipoEvento } from '../integracao-events.constants';

export interface WebhookSubscription {
  id: string;
  url: string;
  secret: string;
  eventos: IntegracaoTipoEvento[];
  createdAt: string;
}

@Injectable()
export class WebhookSubscriptionStore {
  private readonly subs = new Map<string, WebhookSubscription>();

  register(input: Omit<WebhookSubscription, 'id' | 'createdAt'>): WebhookSubscription {
    const id = randomUUID();
    const sub: WebhookSubscription = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
    };
    this.subs.set(id, sub);
    return sub;
  }

  list(): WebhookSubscription[] {
    return [...this.subs.values()];
  }

  get(id: string): WebhookSubscription | undefined {
    return this.subs.get(id);
  }

  /** Assinaturas que escutam o tipo informado. */
  matching(tipo: IntegracaoTipoEvento): WebhookSubscription[] {
    return this.list().filter((s) => s.eventos.includes(tipo));
  }
}
