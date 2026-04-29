import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { WorkflowDef } from '../automacao.types';

@Injectable()
export class AutomacaoWorkflowStore {
  private readonly workflows = new Map<string, WorkflowDef>();

  listar(): WorkflowDef[] {
    return [...this.workflows.values()].sort(
      (a, b) => a.prioridade - b.prioridade || a.criadoEm.localeCompare(b.criadoEm),
    );
  }

  porEvento(evento: string): WorkflowDef[] {
    return this.listar().filter((w) => w.ativo && w.eventoDisparo === evento);
  }

  obter(id: string): WorkflowDef | undefined {
    return this.workflows.get(id);
  }

  salvar(w: Omit<WorkflowDef, 'id' | 'criadoEm' | 'atualizadoEm'> & { id?: string }): WorkflowDef {
    const now = new Date().toISOString();
    const id = w.id ?? randomUUID();
    const prev = this.workflows.get(id);
    const full: WorkflowDef = {
      ...w,
      id,
      criadoEm: prev?.criadoEm ?? now,
      atualizadoEm: now,
    };
    this.workflows.set(id, full);
    return full;
  }

  remover(id: string): boolean {
    return this.workflows.delete(id);
  }

  definirAtivo(id: string, ativo: boolean): WorkflowDef | undefined {
    const w = this.workflows.get(id);
    if (!w) return undefined;
    w.ativo = ativo;
    w.atualizadoEm = new Date().toISOString();
    return w;
  }
}
