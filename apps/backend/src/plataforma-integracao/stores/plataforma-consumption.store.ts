import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { ConsumoRegistro } from '../plataforma.types';

@Injectable()
export class PlataformaConsumptionStore {
  private readonly registros: ConsumoRegistro[] = [];
  private readonly incidentesSeguranca: Array<{
    id: string;
    tipo: string;
    detalhe: string;
    criadoEm: string;
  }> = [];

  registrar(r: Omit<ConsumoRegistro, 'id' | 'criadoEm'>): ConsumoRegistro {
    const full: ConsumoRegistro = {
      ...r,
      id: randomUUID(),
      criadoEm: new Date().toISOString(),
    };
    this.registros.push(full);
    if (this.registros.length > 15_000) this.registros.splice(0, this.registros.length - 15_000);
    return full;
  }

  registrarIncidente(tipo: string, detalhe: string) {
    this.incidentesSeguranca.push({
      id: randomUUID(),
      tipo,
      detalhe,
      criadoEm: new Date().toISOString(),
    });
    if (this.incidentesSeguranca.length > 2_000) this.incidentesSeguranca.splice(0, 500);
  }

  ultimos(lim = 500): ConsumoRegistro[] {
    return [...this.registros].slice(-lim).reverse();
  }

  incidentes(lim = 50) {
    return [...this.incidentesSeguranca].slice(-lim).reverse();
  }

  agregarPorCliente() {
    const map = new Map<string, { chamadas: number; erros4xx: number; erros5xx: number; latenciaSoma: number }>();
    for (const r of this.registros) {
      const cur = map.get(r.apiClientId) ?? { chamadas: 0, erros4xx: 0, erros5xx: 0, latenciaSoma: 0 };
      cur.chamadas += 1;
      if (r.statusHttp >= 400 && r.statusHttp < 500) cur.erros4xx += 1;
      if (r.statusHttp >= 500) cur.erros5xx += 1;
      cur.latenciaSoma += r.latencyMs;
      map.set(r.apiClientId, cur);
    }
    return [...map.entries()].map(([apiClientId, v]) => ({
      apiClientId,
      ...v,
      latenciaMediaMs: v.chamadas ? Math.round(v.latenciaSoma / v.chamadas) : 0,
    }));
  }

  rotasMaisChamadas(top = 20) {
    const m = new Map<string, number>();
    for (const r of this.registros) m.set(r.rota, (m.get(r.rota) ?? 0) + 1);
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([rota, qt]) => ({ rota, qt }));
  }
}
