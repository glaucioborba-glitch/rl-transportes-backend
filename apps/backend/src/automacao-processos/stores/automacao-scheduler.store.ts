import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { CronJobDef } from '../automacao.types';

@Injectable()
export class AutomacaoSchedulerStore {
  private readonly crons: CronJobDef[] = [];

  listar(): CronJobDef[] {
    return [...this.crons];
  }

  adicionar(p: Omit<CronJobDef, 'id'>): CronJobDef {
    const c: CronJobDef = { id: randomUUID(), ...p };
    this.crons.push(c);
    return c;
  }
}
