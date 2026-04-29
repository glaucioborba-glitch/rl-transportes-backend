import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { RpaJob, RpaRobotId, RpaJobStatus } from '../automacao.types';

@Injectable()
export class AutomacaoRpaJobStore {
  readonly jobs: RpaJob[] = [];

  registrar(inicio: Omit<RpaJob, 'id'>): RpaJob {
    const j: RpaJob = { id: randomUUID(), ...inicio };
    this.jobs.push(j);
    if (this.jobs.length > 2000) this.jobs.splice(0, 500);
    return j;
  }

  atualizar(id: string, patch: Partial<Pick<RpaJob, 'status' | 'finalizadoEm' | 'mensagem' | 'tentativa'>>) {
    const j = this.jobs.find((x) => x.id === id);
    if (!j) return undefined;
    Object.assign(j, patch);
    return j;
  }

  ultimos(n = 100): RpaJob[] {
    return [...this.jobs].slice(-n).reverse();
  }

  static validarRobot(id: string): id is RpaRobotId {
    return [
      'rpa_faturamento_auto',
      'rpa_nfse_sugestao',
      'rpa_reconcilia_boleto',
      'rpa_operacao_ciclo',
      'rpa_rh_absenteismo',
      'rpa_grc_incidentes',
    ].includes(id);
  }
}
