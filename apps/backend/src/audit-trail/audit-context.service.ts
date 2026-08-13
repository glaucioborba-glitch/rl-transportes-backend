import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export type AuditContextState = {
  tenantId: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioRole: string;
  ipAddress?: string;
};

export const SISTEMA_AUDIT_ACTOR: AuditContextState = {
  tenantId: 'default',
  usuarioId: 'SISTEMA',
  usuarioNome: 'Sistema',
  usuarioRole: 'SISTEMA',
};

@Injectable()
export class AuditContextService {
  private readonly als = new AsyncLocalStorage<AuditContextState>();

  run<T>(state: AuditContextState, fn: () => T): T {
    return this.als.run(state, fn);
  }

  getState(): AuditContextState | undefined {
    return this.als.getStore();
  }

  resolveActor(): AuditContextState {
    return this.getState() ?? SISTEMA_AUDIT_ACTOR;
  }
}
