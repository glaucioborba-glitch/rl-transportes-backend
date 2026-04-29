import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

export type IotTipoSensor = 'ocupacaoPatio' | 'temperaturaContainer' | 'vigilanciaMovimento';

export interface IotReading {
  id: string;
  tipo: IotTipoSensor;
  valor: number;
  raw?: Record<string, unknown>;
  receivedAt: string;
}

const MAX = 500;

@Injectable()
export class IotSensorStore {
  private readings: IotReading[] = [];

  add(input: Omit<IotReading, 'id' | 'receivedAt'>): IotReading {
    const r: IotReading = {
      ...input,
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
    };
    this.readings.push(r);
    if (this.readings.length > MAX) this.readings = this.readings.slice(-MAX);
    return r;
  }

  recent(limit = 100): IotReading[] {
    return [...this.readings].reverse().slice(0, limit);
  }
}
