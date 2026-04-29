import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  ControleInternoEntity,
  PlanoAcaoGrcEntity,
  RiscoGrcEntity,
} from './grc-compliance.domain';

@Injectable()
export class GrcComplianceStoreService {
  private riscos = new Map<string, RiscoGrcEntity>();
  private controles = new Map<string, ControleInternoEntity>();
  private planos = new Map<string, PlanoAcaoGrcEntity>();

  createRisco(input: Omit<RiscoGrcEntity, 'id' | 'createdAt'>): RiscoGrcEntity {
    const id = randomUUID();
    const e: RiscoGrcEntity = {
      ...input,
      id,
      createdAt: new Date().toISOString(),
    };
    this.riscos.set(id, e);
    return e;
  }

  listRiscos(): RiscoGrcEntity[] {
    return [...this.riscos.values()].sort((a, b) => b.severidade - a.severidade);
  }

  getRisco(id: string): RiscoGrcEntity | undefined {
    return this.riscos.get(id);
  }

  createControle(input: Omit<ControleInternoEntity, 'id' | 'createdAt'>): ControleInternoEntity {
    const id = randomUUID();
    const e: ControleInternoEntity = { ...input, id, createdAt: new Date().toISOString() };
    this.controles.set(id, e);
    return e;
  }

  listControles(): ControleInternoEntity[] {
    return [...this.controles.values()].sort((a, b) => a.nomeControle.localeCompare(b.nomeControle, 'pt-BR'));
  }

  createPlano(input: Omit<PlanoAcaoGrcEntity, 'id' | 'createdAt'>): PlanoAcaoGrcEntity {
    const id = randomUUID();
    const e: PlanoAcaoGrcEntity = { ...input, id, createdAt: new Date().toISOString() };
    this.planos.set(id, e);
    return e;
  }

  listPlanos(): PlanoAcaoGrcEntity[] {
    return [...this.planos.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  assertRiscoExists(id: string): void {
    if (!this.riscos.has(id)) throw new BadRequestException('riscoRelacionadoId não encontrado.');
  }
}
