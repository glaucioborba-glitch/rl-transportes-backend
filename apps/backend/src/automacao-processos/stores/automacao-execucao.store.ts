import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type AutomacaoExecucaoTipo = 'workflow' | 'orquestrador' | 'regra' | 'rpa';

export interface AutomacaoExecucaoLog {
  id: string;
  tipo: AutomacaoExecucaoTipo;
  evento?: string;
  workflowId?: string;
  regraId?: string;
  rpaJobId?: string;
  ok: boolean;
  detalhe?: string;
  acoesResumo: string[];
  criadoEm: string;
}

@Injectable()
export class AutomacaoExecucaoStore {
  readonly logs: AutomacaoExecucaoLog[] = [];

  registrar(entry: Omit<AutomacaoExecucaoLog, 'id' | 'criadoEm'>): AutomacaoExecucaoLog {
    const e: AutomacaoExecucaoLog = {
      id: randomUUID(),
      criadoEm: new Date().toISOString(),
      ...entry,
    };
    this.logs.push(e);
    if (this.logs.length > 5000) this.logs.splice(0, 1000);
    return e;
  }

  ultimas24h(): AutomacaoExecucaoLog[] {
    const t = Date.now() - 24 * 60 * 60 * 1000;
    return this.logs.filter((l) => new Date(l.criadoEm).getTime() >= t);
  }

  comErroUltimas24h(): AutomacaoExecucaoLog[] {
    return this.ultimas24h().filter((l) => !l.ok);
  }
}
