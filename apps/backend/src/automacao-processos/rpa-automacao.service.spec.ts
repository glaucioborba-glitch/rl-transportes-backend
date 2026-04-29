import { RpaAutomacaoService } from './rpa/rpa-automacao.service';
import { AutomacaoRpaJobStore } from './stores/automacao-rpa-job.store';
import { AutomacaoExecucaoStore } from './stores/automacao-execucao.store';

describe('RpaAutomacaoService', () => {
  it('agendarExecucao valida robot e marca sucesso assíncrono', async () => {
    const svc = new RpaAutomacaoService(new AutomacaoRpaJobStore(), new AutomacaoExecucaoStore());
    const { jobId } = svc.agendarExecucao('rpa_faturamento_auto');
    expect(jobId).toBeDefined();

    await new Promise((r) => setTimeout(r, 80));
    const jobs = svc.listarJobs();
    const j = jobs.find((x) => x.id === jobId);
    expect(j?.status).toBe('sucesso');
  });

  it('robot inválido lança', () => {
    const svc = new RpaAutomacaoService(new AutomacaoRpaJobStore(), new AutomacaoExecucaoStore());
    expect(() => svc.agendarExecucao('invalid' as 'rpa_faturamento_auto')).toThrow('robot_invalido');
  });
});
