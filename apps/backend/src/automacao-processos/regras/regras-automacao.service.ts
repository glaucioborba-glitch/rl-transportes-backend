import { Injectable, Logger } from '@nestjs/common';
import { avaliarExpressaoRegra } from '../automacao-rule-engine';
import { AutomacaoRegrasStore } from '../stores/automacao-regras.store';
import { AutomacaoExecucaoStore } from '../stores/automacao-execucao.store';
import type { RegraNegocio } from '../automacao.types';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

@Injectable()
export class RegrasAutomacaoService {
  private readonly logger = new Logger(RegrasAutomacaoService.name);

  constructor(
    private readonly store: AutomacaoRegrasStore,
    private readonly execucao: AutomacaoExecucaoStore,
    private readonly workflows: WorkflowEngineService,
  ) {}

  listar(): RegraNegocio[] {
    return this.store.listar();
  }

  salvar(r: Omit<RegraNegocio, 'id' | 'criadoEm'> & { id?: string }): RegraNegocio {
    return this.store.salvar(r);
  }

  async avaliarParaEvento(evento: string, payload: Record<string, unknown>): Promise<void> {
    const ctx = { ...payload, evento };
    const ativas = this.store.listar().filter((x) => x.ativo);

    for (const regra of ativas) {
      if (!avaliarExpressaoRegra(regra.if, ctx)) continue;

      const acoesResumo = await this.executarThen(regra, ctx, true);
      this.execucao.registrar({
        tipo: 'regra',
        evento,
        regraId: regra.id,
        ok: true,
        acoesResumo,
      });
      this.logger.log({ msg: 'automacao.regra.disparada', regraId: regra.id, evento });
    }
  }

  /**
   * Interpretação mínima do THEN: tokens separados por + ; workflow:ID dispara teste de encadeamento.
   */
  private async executarThen(
    regra: RegraNegocio,
    ctx: Record<string, unknown>,
    usarPayloadReal: boolean,
  ): Promise<string[]> {
    const res: string[] = [];
    const then = regra.then.trim();
    if (then.includes('alerta')) {
      res.push('alerta:emitir(simulado)');
    }
    if (then.includes('auditoria')) {
      res.push('auditoria:anexar(simulado)');
    }
    const mWf = /workflow:([a-zA-Z0-9-]+)/.exec(then);
    if (mWf) {
      const id = mWf[1];
      if (usarPayloadReal) {
        const ok = await this.workflows.executarWorkflowPorId(id, ctx);
        res.push(`workflow_encadeado:${id}:${ok ? 'ok' : 'falha'}`);
      } else {
        res.push(`workflow_encadeado(dry):${id}`);
      }
    }
    if (!res.length) res.push('then:registrado');
    return res;
  }
}
