import { Injectable } from '@nestjs/common';
import { AutomacaoRpaJobStore } from '../stores/automacao-rpa-job.store';
import { AutomacaoExecucaoStore } from '../stores/automacao-execucao.store';
import type { RpaRobotId } from '../automacao.types';

@Injectable()
export class RpaAutomacaoService {
  constructor(
    private readonly jobs: AutomacaoRpaJobStore,
    private readonly execucao: AutomacaoExecucaoStore,
  ) {}

  async listarJobs() {
    return this.jobs.ultimos(200);
  }

  /** Enfileira execução assíncrona (não bloqueante). */
  async agendarExecucao(robotId: RpaRobotId): Promise<{ jobId: string; status: string }> {
    if (!AutomacaoRpaJobStore.validarRobot(robotId)) {
      throw new Error('robot_invalido');
    }
    const job = await this.jobs.registrar({
      robotId,
      status: 'pendente',
      iniciadoEm: new Date().toISOString(),
      tentativa: 0,
    });

    setImmediate(() => {
      void this.executarJob(job.id, robotId);
    });

    return { jobId: job.id, status: 'pendente' };
  }

  private async executarJob(jobId: string, robotId: RpaRobotId) {
    await this.jobs.atualizar(jobId, { status: 'executando', tentativa: 1 });
    try {
      await this.simularTrabalho(robotId);
      await this.jobs.atualizar(jobId, {
        status: 'sucesso',
        finalizadoEm: new Date().toISOString(),
        mensagem: 'concluido_simulado',
      });
      await this.execucao.registrar({
        tipo: 'rpa',
        rpaJobId: jobId,
        ok: true,
        acoesResumo: [`robot:${robotId}`],
      });
    } catch (e) {
      await this.jobs.atualizar(jobId, {
        status: 'falha',
        finalizadoEm: new Date().toISOString(),
        mensagem: (e as Error).message,
      });
      await this.execucao.registrar({
        tipo: 'rpa',
        rpaJobId: jobId,
        ok: false,
        detalhe: (e as Error).message,
        acoesResumo: [`robot:${robotId}`],
      });
    }
  }

  private async simularTrabalho(robotId: RpaRobotId): Promise<void> {
    await new Promise((r) => setTimeout(r, 15));
    if (robotId === 'rpa_grc_incidentes') {
      /* cenário de validação falha opcional — mantém sucesso para operação padrão */
    }
  }
}
