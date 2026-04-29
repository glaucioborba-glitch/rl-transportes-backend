import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  AvaliacaoRhEntity,
  OkrRhEntity,
  TreinamentoRhEntity,
} from './rh-performance.domain';

@Injectable()
export class RhPerformanceStoreService {
  private avaliacoes = new Map<string, AvaliacaoRhEntity>();
  private okrs = new Map<string, OkrRhEntity>();
  private treinamentos = new Map<string, TreinamentoRhEntity>();

  createAvaliacao(input: Omit<AvaliacaoRhEntity, 'id' | 'createdAt'>): AvaliacaoRhEntity {
    const id = randomUUID();
    const e: AvaliacaoRhEntity = { ...input, id, createdAt: new Date().toISOString() };
    this.avaliacoes.set(id, e);
    return e;
  }

  listAvaliacoes(): AvaliacaoRhEntity[] {
    return [...this.avaliacoes.values()].sort((a, b) => b.periodo.localeCompare(a.periodo));
  }

  createOkr(input: Omit<OkrRhEntity, 'id' | 'createdAt'>): OkrRhEntity {
    const id = randomUUID();
    const e: OkrRhEntity = { ...input, id, createdAt: new Date().toISOString() };
    this.okrs.set(id, e);
    return e;
  }

  listOkrs(): OkrRhEntity[] {
    return [...this.okrs.values()].sort((a, b) => b.periodoInicio.localeCompare(a.periodoInicio));
  }

  createTreinamento(input: Omit<TreinamentoRhEntity, 'id' | 'createdAt'>): TreinamentoRhEntity {
    const id = randomUUID();
    const e: TreinamentoRhEntity = { ...input, id, createdAt: new Date().toISOString() };
    this.treinamentos.set(id, e);
    return e;
  }

  listTreinamentos(): TreinamentoRhEntity[] {
    return [...this.treinamentos.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  treinamentosPorColaborador(colaboradorId: string): TreinamentoRhEntity[] {
    return this.listTreinamentos().filter((t) => t.colaboradorId === colaboradorId);
  }
}
