import { Injectable } from '@nestjs/common';
import { AutomacaoWorkflowStore } from '../stores/automacao-workflow.store';
import { AutomacaoExecucaoStore } from '../stores/automacao-execucao.store';
import { AutomacaoRpaJobStore } from '../stores/automacao-rpa-job.store';
import { AutomacaoSchedulerStore } from '../stores/automacao-scheduler.store';

@Injectable()
export class DashboardAutomacaoService {
  constructor(
    private readonly workflows: AutomacaoWorkflowStore,
    private readonly execucao: AutomacaoExecucaoStore,
    private readonly rpaJobs: AutomacaoRpaJobStore,
    private readonly schedulers: AutomacaoSchedulerStore,
  ) {}

  resumo() {
    const wfs = this.workflows.listar();
    const ult24 = this.execucao.ultimas24h();
    const erros = this.execucao.comErroUltimas24h();
    const jobs = this.rpaJobs.ultimos(500);
    const ult24t = Date.now() - 24 * 60 * 60 * 1000;
    const jobsUlt24 = jobs.filter((j) => new Date(j.iniciadoEm).getTime() >= ult24t);
    const gatilhos = this.contarGatilhos(ult24);

    return {
      automacoesAtivas: wfs.filter((w) => w.ativo).length,
      workflowsTotal: wfs.length,
      execucoesUltimas24h: ult24.filter((e) => e.tipo === 'workflow').length,
      errosAutomacaoUltimas24h: erros.length,
      rpaJobsAtivosOuRecentes: jobsUlt24.filter((j) => j.status === 'executando' || j.status === 'pendente').length,
      rpaJobsFalhosUlt24h: jobsUlt24.filter((j) => j.status === 'falha').length,
      gatilhosMaisAcionados: gatilhos.slice(0, 8),
      economiaTempoProxyMinutos: Math.round(ult24.length * 2.5),
      impactoOperacionalScoreProxy: Math.min(100, 40 + ult24.filter((x) => x.ok).length * 3),
      cronAgendamentos: this.schedulers.listar().filter((c) => c.ativo).length,
    };
  }

  private contarGatilhos(logs: { evento?: string }[]) {
    const m = new Map<string, number>();
    for (const l of logs) {
      if (!l.evento) continue;
      m.set(l.evento, (m.get(l.evento) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([evento, count]) => ({ evento, count }))
      .sort((a, b) => b.count - a.count);
  }
}
