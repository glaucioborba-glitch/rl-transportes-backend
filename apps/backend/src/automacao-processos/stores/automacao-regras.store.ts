import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { RegraNegocio } from '../automacao.types';

@Injectable()
export class AutomacaoRegrasStore {
  private readonly regras = new Map<string, RegraNegocio>();

  listar(): RegraNegocio[] {
    return [...this.regras.values()];
  }

  salvar(r: Omit<RegraNegocio, 'id' | 'criadoEm'> & { id?: string }): RegraNegocio {
    const id = r.id ?? randomUUID();
    const full: RegraNegocio = {
      ...r,
      id,
      criadoEm: this.regras.get(id)?.criadoEm ?? new Date().toISOString(),
    };
    this.regras.set(id, full);
    return full;
  }
}
