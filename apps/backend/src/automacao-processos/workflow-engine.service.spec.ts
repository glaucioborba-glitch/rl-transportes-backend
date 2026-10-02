import { WorkflowEngineService } from './workflow-engine/workflow-engine.service';
import type { AutomacaoWorkflowStore } from './stores/automacao-workflow.store';
import type { AutomacaoExecucaoStore } from './stores/automacao-execucao.store';

describe('WorkflowEngineService', () => {
  let engine: WorkflowEngineService;
  let store: jest.Mocked<AutomacaoWorkflowStore>;
  let exec: jest.Mocked<AutomacaoExecucaoStore>;

  beforeEach(() => {
    const workflows = new Map<string, ReturnType<typeof baseWorkflow>>();

    store = {
      listar: jest.fn(async () => [...workflows.values()]),
      porEvento: jest.fn(async (evento: string) =>
        [...workflows.values()].filter((w) => w.ativo && w.eventoDisparo === evento),
      ),
      obter: jest.fn(async (id: string) => workflows.get(id)),
      salvar: jest.fn(async (w) => {
        const full = baseWorkflow(w);
        workflows.set(full.id, full);
        return full;
      }),
      remover: jest.fn(async (id: string) => workflows.delete(id)),
      definirAtivo: jest.fn(async (id: string, ativo: boolean) => {
        const w = workflows.get(id);
        if (!w) return undefined;
        w.ativo = ativo;
        return w;
      }),
    } as unknown as jest.Mocked<AutomacaoWorkflowStore>;

    const logs: Array<{ workflowId?: string }> = [];
    exec = {
      registrar: jest.fn(async (entry) => {
        const log = { id: 'log-1', criadoEm: new Date().toISOString(), ...entry };
        logs.push(log);
        return log;
      }),
      ultimas24h: jest.fn(async () => logs as never),
      comErroUltimas24h: jest.fn(async () => []),
    } as unknown as jest.Mocked<AutomacaoExecucaoStore>;

    engine = new WorkflowEngineService(store, exec);
  });

  it('processarEvento aplica primeiro workflow por prioridade', async () => {
    await store.salvar({
      nome: 'B',
      eventoDisparo: 'gate.registrado',
      condicoes: [],
      acoes: [{ tipo: 'emitir_alerta', params: {} }],
      prioridade: 3,
      ativo: true,
    });
    await store.salvar({
      nome: 'A',
      eventoDisparo: 'gate.registrado',
      condicoes: [],
      acoes: [{ tipo: 'log_destino_modulo', params: { modulo: 'financeiro' } }],
      prioridade: 1,
      ativo: true,
    });

    await engine.processarEvento('gate.registrado', { x: 1 });

    expect(exec.registrar).toHaveBeenCalledTimes(1);
    const call = exec.registrar.mock.calls[0][0];
    expect(call.workflowId).toBeDefined();
    const w = await store.obter(call.workflowId!);
    expect(w?.nome).toBe('A');
  });

  it('testar usa rascunho', async () => {
    const r = await engine.testar({
      eventoDisparo: 'boleto.pago',
      payload: { valor: 2000 },
      rascunho: {
        nome: 'draft',
        eventoDisparo: 'boleto.pago',
        condicoes: [{ campo: 'valor', op: 'gte', valor: 1000 }],
        acoes: [{ tipo: 'sugerir_nfse' }],
        prioridade: 2,
        ativo: true,
      },
    });
    expect(r.aplicouWorkflow).toBe(true);
    expect(r.acoes.some((a) => a.tipo === 'sugerir_nfse')).toBe(true);
  });
});

function baseWorkflow(
  w: Omit<import('./automacao.types').WorkflowDef, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: string },
) {
  const now = new Date().toISOString();
  return {
    ...w,
    id: w.id ?? `wf-${Math.random().toString(36).slice(2)}`,
    criadoEm: now,
    atualizadoEm: now,
  };
}
