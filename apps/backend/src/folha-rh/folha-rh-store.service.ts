import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  BeneficioRhEntity,
  ColaboradorRhEntity,
  PresencaRhEntity,
} from './folha-rh.domain';

@Injectable()
export class FolhaRhStoreService {
  private colaboradores = new Map<string, ColaboradorRhEntity>();
  private beneficios = new Map<string, BeneficioRhEntity>();
  private presencas = new Map<string, PresencaRhEntity>();

  createColaborador(input: Omit<ColaboradorRhEntity, 'id' | 'createdAt'>): ColaboradorRhEntity {
    const id = randomUUID();
    const e: ColaboradorRhEntity = { ...input, id, createdAt: new Date().toISOString() };
    this.colaboradores.set(id, e);
    return e;
  }

  listColaboradores(): ColaboradorRhEntity[] {
    return [...this.colaboradores.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  getColaborador(id: string): ColaboradorRhEntity | undefined {
    return this.colaboradores.get(id);
  }

  createBeneficio(input: Omit<BeneficioRhEntity, 'id' | 'createdAt'>): BeneficioRhEntity {
    const id = randomUUID();
    const e: BeneficioRhEntity = { ...input, id, createdAt: new Date().toISOString() };
    this.beneficios.set(id, e);
    return e;
  }

  listBeneficios(): BeneficioRhEntity[] {
    return [...this.beneficios.values()].sort((a, b) =>
      a.nomeBeneficio.localeCompare(b.nomeBeneficio, 'pt-BR'),
    );
  }

  createPresenca(input: Omit<PresencaRhEntity, 'id' | 'createdAt'>): PresencaRhEntity {
    const id = randomUUID();
    const e: PresencaRhEntity = { ...input, id, createdAt: new Date().toISOString() };
    this.presencas.set(id, e);
    return e;
  }

  listPresencas(): PresencaRhEntity[] {
    return [...this.presencas.values()].sort((a, b) => b.data.localeCompare(a.data));
  }

  presencasDoMes(colaboradorId: string, mesPrefix: string): PresencaRhEntity[] {
    return [...this.presencas.values()].filter(
      (p) => p.colaboradorId === colaboradorId && p.data.startsWith(mesPrefix),
    );
  }
}
