import { Injectable, Logger } from '@nestjs/common';
import type { WorkflowDef } from '../automacao.types';
import { avaliarCondicoes } from '../automacao-rule-engine';
import { AutomacaoWorkflowStore } from '../stores/automacao-workflow.store';
import { AutomacaoExecucaoStore } from '../stores/automacao-execucao.store';

export interface AcaoSimuladaResultado {
  tipo: string;
  ok: boolean;
  saida?: Record<string, unknown>;
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly store: AutomacaoWorkflowStore,
    private readonly execucao: AutomacaoExecucaoStore,
  ) {}

  listar(): WorkflowDef[] {
    return this.store.listar();
  }

  criarOuAtualizar(w: Omit<WorkflowDef, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: string }): WorkflowDef {
    return this.store.salvar(w);
  }

  remover(id: string): boolean {
    return this.store.remover(id);
  }

  definirAtivo(id: string, ativo: boolean): WorkflowDef | undefined {
    return this.store.definirAtivo(id, ativo);
  }

  /** Simula um workflow sem persistir (ou usa rascunho inline). */
  testar(params: {
    eventoDisparo: string;
    payload: Record<string, unknown>;
    rascunho?: Omit<WorkflowDef, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: string };
  }): {
    aplicouWorkflow: boolean;
    workflowNome?: string;
    acoes: AcaoSimuladaResultado[];
  } {
    const wf: WorkflowDef | null = params.rascunho
      ? ({
          id: 'draft',
          nome: params.rascunho.nome ?? 'rascunho',
          eventoDisparo: params.rascunho.eventoDisparo,
          condicoes: params.rascunho.condicoes ?? [],
          acoes: params.rascunho.acoes ?? [],
          prioridade: params.rascunho.prioridade ?? 3,
          ativo: params.rascunho.ativo ?? true,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        } as WorkflowDef)
      : null;

    const candidatos = wf
      ? wf.eventoDisparo === params.eventoDisparo && wf.ativo
        ? [wf]
        : []
      : this.store.porEvento(params.eventoDisparo);

    if (!candidatos.length) {
      return { aplicouWorkflow: false, acoes: [] };
    }

    const ordenados = [...candidatos].sort((a, b) => a.prioridade - b.prioridade);
    const acoes: AcaoSimuladaResultado[] = [];
    let aplicou = false;
    let workflowNome: string | undefined;

    for (const workflow of ordenados) {
      if (!avaliarCondicoes(params.payload, workflow.condicoes)) continue;
      aplicou = true;
      workflowNome = workflow.nome;
      for (const acao of workflow.acoes) {
        acoes.push(this.simularAcao(acao.tipo, acao.params ?? {}, params.payload));
      }
      break;
    }

    return { aplicouWorkflow: aplicou, workflowNome, acoes };
  }

  /** Executa ações de um workflow específico (ex.: encadeamento por regra). */
  async executarWorkflowPorId(workflowId: string, payload: Record<string, unknown>, maxRetries = 2): Promise<boolean> {
    const workflow = this.store.obter(workflowId);
    if (!workflow?.ativo) return false;

    const acoesResumo: string[] = [];
    let ok = true;
    let detalhe: string | undefined;

    for (const acao of workflow.acoes) {
      let attempt = 0;
      let lastErr: string | undefined;
      while (attempt <= maxRetries) {
        try {
          const r = this.simularAcao(acao.tipo, acao.params ?? {}, payload);
          acoesResumo.push(`${acao.tipo}:${r.ok ? 'ok' : 'falha'}`);
          if (!r.ok) {
            ok = false;
            lastErr = String(r.saida?.erro ?? 'acao_falhou');
          } else lastErr = undefined;
          break;
        } catch (e) {
          lastErr = (e as Error).message;
          attempt++;
          await new Promise((r) => setTimeout(r, 80 * attempt));
        }
      }
      if (lastErr) {
        ok = false;
        detalhe = lastErr;
        acoesResumo.push(`retry_exceeded:${acao.tipo}`);
      }
    }

    this.execucao.registrar({
      tipo: 'workflow',
      evento: `workflowId:${workflowId}`,
      workflowId,
      ok,
      detalhe,
      acoesResumo,
    });

    this.logger.log({
      msg: 'automacao.workflow.por_id',
      workflowId,
      ok,
      acoes: acoesResumo,
    });

    return ok;
  }

  /** Dispara workflows para evento real (não destrutivo). */
  async processarEvento(evento: string, payload: Record<string, unknown>, maxRetries = 2): Promise<void> {
    const candidatos = this.store.porEvento(evento);
    const ordenados = [...candidatos].sort((a, b) => a.prioridade - b.prioridade);

    for (const workflow of ordenados) {
      if (!avaliarCondicoes(payload, workflow.condicoes)) continue;

      const acoesResumo: string[] = [];
      let ok = true;
      let detalhe: string | undefined;

      for (const acao of workflow.acoes) {
        let attempt = 0;
        let lastErr: string | undefined;
        while (attempt <= maxRetries) {
          try {
            const r = this.simularAcao(acao.tipo, acao.params ?? {}, payload);
            acoesResumo.push(`${acao.tipo}:${r.ok ? 'ok' : 'falha'}`);
            if (!r.ok) {
              ok = false;
              lastErr = String(r.saida?.erro ?? 'acao_falhou');
            }
            lastErr = undefined;
            break;
          } catch (e) {
            lastErr = (e as Error).message;
            attempt++;
            await new Promise((r) => setTimeout(r, 80 * attempt));
          }
        }
        if (lastErr) {
          ok = false;
          detalhe = lastErr;
          acoesResumo.push(`retry_exceeded:${acao.tipo}`);
        }
      }

      this.execucao.registrar({
        tipo: 'workflow',
        evento,
        workflowId: workflow.id,
        ok,
        detalhe,
        acoesResumo,
      });

      this.logger.log({
        msg: 'automacao.workflow.executado',
        evento,
        workflowId: workflow.id,
        ok,
        acoes: acoesResumo,
      });

      break;
    }
  }

  private simularAcao(
    tipo: string,
    params: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): AcaoSimuladaResultado {
    switch (tipo) {
      case 'criar_faturamento_simulado':
        return {
          tipo,
          ok: true,
          saida: { simulado: true, valorProxy: params.valor ?? payload.valor ?? null },
        };
      case 'enviar_webhook':
        return { tipo, ok: true, saida: { queued: true, urlProxy: params.url ?? 'internal' } };
      case 'emitir_alerta':
        return { tipo, ok: true, saida: { canal: params.canal ?? 'in_app', severidade: params.severidade ?? 'info' } };
      case 'gerar_os_simulada':
        return { tipo, ok: true, saida: { osIdProxy: `os-sim-${Date.now()}` } };
      case 'anexar_auditoria':
        return { tipo, ok: true, saida: { anexoSimulado: true, ref: params.ref ?? 'audit' } };
      case 'atualizar_status_operacional_simulado':
        return { tipo, ok: true, saida: { status: params.status ?? 'ok' } };
      case 'sugerir_nfse':
        return { tipo, ok: true, saida: { sugestao: true, motivo: params.motivo ?? 'workflow' } };
      case 'disparar_workflow':
        return { tipo, ok: true, saida: { proximoWorkflowId: params.workflowId ?? null } };
      case 'log_destino_modulo':
        return {
          tipo,
          ok: true,
          saida: { modulo: params.modulo ?? 'generico', destino: (params.destino as string) ?? 'bi' },
        };
      default:
        return { tipo, ok: false, saida: { erro: `acao_desconhecida:${tipo}` } };
    }
  }
}
