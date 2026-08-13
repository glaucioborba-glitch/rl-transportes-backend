import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';

export type TenantContextState = {
  tenantId: string | null;
  bypassIsolation: boolean;
};

@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantContextState>();

  run<T>(state: TenantContextState, fn: () => T): T {
    return this.als.run(state, fn);
  }

  getState(): TenantContextState | undefined {
    return this.als.getStore();
  }

  getTenantId(): string | null {
    return this.als.getStore()?.tenantId ?? null;
  }

  isBypass(): boolean {
    return this.als.getStore()?.bypassIsolation === true;
  }

  setFromAuth(role: Role, tenantId?: string | null): TenantContextState {
    if (role === Role.SUPER_ADMIN) {
      return { tenantId: tenantId ?? null, bypassIsolation: true };
    }
    return { tenantId: tenantId ?? 'default', bypassIsolation: false };
  }
}
