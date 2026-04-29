import { EventEmitter } from 'events';

/** Ponte Fase 14 → Fase 19: eventos internos sem acoplamento direto entre módulos. */
export const automacaoIntegracaoBus = new EventEmitter();
automacaoIntegracaoBus.setMaxListeners(32);

export type IntegracaoEventoBridgePayload = {
  tipo: string;
  payload: Record<string, unknown>;
  clienteId?: string;
  correlationId?: string;
};
