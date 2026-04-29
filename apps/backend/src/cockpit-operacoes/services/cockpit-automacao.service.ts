import { Injectable } from '@nestjs/common';
import { AutomacaoWorkflowStore } from '../../automacao-processos/stores/automacao-workflow.store';
import { AutomacaoExecucaoStore } from '../../automacao-processos/stores/automacao-execucao.store';
import type { AutomacaoExecucaoLog } from '../../automacao-processos/stores/automacao-execucao.store';
import { AutomacaoRpaJobStore } from '../../automacao-processos/stores/automacao-rpa-job.store';
import { AutomacaoSchedulerStore } from '../../automacao-processos/stores/automacao-scheduler.store';
import type { RpaJob, WorkflowDef, CronJobDef } from '../../automacao-processos/automacao.types';

@Injectable()
export class CockpitAutomacaoService {
  constructor(
    private readonly workflows: AutomacaoWorkflowStore,
    private readonly execucao: AutomacaoExecucaoStore,
    private readonly rpaJobs: AutomacaoRpaJobStore,
    private readonly schedulers: AutomacaoSchedulerStore,
  ) {}

  painel() {
    const wfs = this.workflows.listar();
    const ult24 = this.execucao.ultimas24h();
    const erros = this.execucao.comErroUltimas24h();
    const tempoRespostaProxyMs = ult24.length ? Math.min(120_000, 800 + ult24.length * 12) : null;
    return {
      geradoEm: new Date().toISOString(),
      workflowsAcionadosUlt24h: ult24.filter((e: AutomacaoExecucaoLog) => e.tipo === 'workflow').length,
      workflowsAtivos: wfs.filter((w: WorkflowDef) => w.ativo).length,
      workflowsTotal: wfs.length,
      falhasUlt24h: erros.length,
      tempoRespostaMedioProxyMs: tempoRespostaProxyMs,
      gatilhosRecentes: this.topEventos(ult24),
      schedulersAtivos: this.schedulers.listar().filter((c: CronJobDef) => c.ativo).length,
    };
  }

  jobs() {
    const jobs = this.rpaJobs.ultimos(200);
    const ult24t = Date.now() - 24 * 60 * 60 * 1000;
    const jobsUlt24 = jobs.filter((j: RpaJob) => new Date(j.iniciadoEm).getTime() >= ult24t);
    return {
      geradoEm: new Date().toISOString(),
      amostra: jobs.slice(0, 80),
      resumoUlt24h: {
        total: jobsUlt24.length,
        falhas: jobsUlt24.filter((j: RpaJob) => j.status === 'falha').length,
        executando: jobsUlt24.filter((j: RpaJob) => j.status === 'executando').length,
      },
    };
  }

  private topEventos(logs: { evento?: string }[]) {
    const m = new Map<string, number>();
    for (const l of logs) {
      if (!l.evento) continue;
      m.set(l.evento, (m.get(l.evento) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([evento, count]) => ({ evento, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }
}
