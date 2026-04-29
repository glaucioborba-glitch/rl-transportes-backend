import { Injectable } from '@nestjs/common';
import type { PlataformaServicoId } from '../../plataforma-integracao/plataforma.types';

/** Preferências de marketplace CX (sem cobrança; memória). */
@Injectable()
export class PortalMarketplaceCxStore {
  private readonly byChave = new Map<string, Set<PlataformaServicoId>>();

  private key(tenantId: string, sub: string) {
    return `${tenantId}:${sub}`;
  }

  obter(tenantId: string, sub: string): PlataformaServicoId[] {
    return [...(this.byChave.get(this.key(tenantId, sub)) ?? new Set())];
  }

  definir(tenantId: string, sub: string, servico: PlataformaServicoId, ativo: boolean) {
    const k = this.key(tenantId, sub);
    let s = this.byChave.get(k);
    if (!s) {
      s = new Set();
      this.byChave.set(k, s);
    }
    if (ativo) s.add(servico);
    else s.delete(servico);
    return [...s];
  }
}
