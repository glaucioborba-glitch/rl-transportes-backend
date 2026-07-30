import { RpaAutomacaoService } from './rpa/rpa-automacao.service';
import type { AutomacaoRpaJobStore } from './stores/automacao-rpa-job.store';
import type { AutomacaoExecucaoStore } from './stores/automacao-execucao.store';

describe('RpaAutomacaoService', () => {
  it('agendarExecucao valida robot e marca sucesso assíncrono', async () => {
    const jobs = {
      registrar: jest.fn().mockResolvedValue({
        id: 'job-1',
        robotId: 'rpa_faturamento_auto',
        status: 'pendente',
        iniciadoEm: new Date().toISOString(),
        tentativa: 0,
      }),
      atualizar: jest.fn().mockResolvedValue(undefined),
      ultimos: jest.fn().mockResolvedValue([
        {
          id: 'job-1',
          robotId: 'rpa_faturamento_auto',
          status: 'sucesso',
          iniciadoEm: new Date().toISOString(),
          tentativa: 1,
        },
      ]),
    } as unknown as AutomacaoRpaJobStore;

    const execucao = {
      registrar: jest.fn().mockResolvedValue(undefined),
    } as unknown as AutomacaoExecucaoStore;

    const svc = new RpaAutomacaoService(jobs, execucao);
    const { jobId } = await svc.agendarExecucao('rpa_faturamento_auto');
    expect(jobId).toBe('job-1');

    await new Promise((r) => setTimeout(r, 80));
    const listed = await svc.listarJobs();
    const j = listed.find((x) => x.id === jobId);
    expect(j?.status).toBe('sucesso');
  });

  it('robot inválido lança', async () => {
    const svc = new RpaAutomacaoService(
      { registrar: jest.fn() } as unknown as AutomacaoRpaJobStore,
      { registrar: jest.fn() } as unknown as AutomacaoExecucaoStore,
    );
    await expect(svc.agendarExecucao('invalid' as 'rpa_faturamento_auto')).rejects.toThrow('robot_invalido');
  });
});
