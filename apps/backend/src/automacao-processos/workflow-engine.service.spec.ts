import { WorkflowEngineService } from './workflow-engine/workflow-engine.service';
import { AutomacaoWorkflowStore } from './stores/automacao-workflow.store';
import { AutomacaoExecucaoStore } from './stores/automacao-execucao.store';

describe('WorkflowEngineService', () => {
  let engine: WorkflowEngineService;
  let store: AutomacaoWorkflowStore;
  let exec: AutomacaoExecucaoStore;

  beforeEach(() => {
    store = new AutomacaoWorkflowStore();
    exec = new AutomacaoExecucaoStore();
    engine = new WorkflowEngineService(store, exec);
  });

  it('processarEvento aplica primeiro workflow por prioridade', async () => {
    store.salvar({
      nome: 'B',
      eventoDisparo: 'gate.registrado',
      condicoes: [],
      acoes: [{ tipo: 'emitir_alerta', params: {} }],
      prioridade: 3,
      ativo: true,
    });
    store.salvar({
      nome: 'A',
      eventoDisparo: 'gate.registrado',
      condicoes: [],
      acoes: [{ tipo: 'log_destino_modulo', params: { modulo: 'financeiro' } }],
      prioridade: 1,
      ativo: true,
    });

    await engine.processarEvento('gate.registrado', { x: 1 });

    expect(exec.logs.length).toBe(1);
    expect(exec.logs[0].workflowId).toBeDefined();
    const w = store.obter(exec.logs[0].workflowId!);
    expect(w?.nome).toBe('A');
  });

  it('testar usa rascunho', () => {
    const r = engine.testar({
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
