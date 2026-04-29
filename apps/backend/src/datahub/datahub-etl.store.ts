import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { EtlExecucao, EtlFase } from './datahub.types';

@Injectable()
export class DatahubEtlStore {
  execucoes: EtlExecucao[] = [];
  volumeExtracaoTotal = 0;
  volumeTransformacaoTotal = 0;
  volumeCargaTotal = 0;
  tempoMedioExecucaoMs: number[] = [];
  falhas = 0;

  registrar(exec: Omit<EtlExecucao, 'id'>): EtlExecucao {
    const full: EtlExecucao = { ...exec, id: randomUUID() };
    this.execucoes.push(full);
    if (full.status === 'FALHA') this.falhas += 1;
    if (full.fase === 'extrair' && full.linhasSaida != null) this.volumeExtracaoTotal += full.linhasSaida;
    if (full.fase === 'transformar' && full.linhasSaida != null)
      this.volumeTransformacaoTotal += full.linhasSaida;
    if (full.fase === 'carregar' && full.linhasSaida != null) this.volumeCargaTotal += full.linhasSaida;
    this.tempoMedioExecucaoMs.push(full.duracaoMs);
    if (this.execucoes.length > 500) this.execucoes = this.execucoes.slice(-500);
    return full;
  }

  metricasAgregadas() {
    const lat = this.tempoMedioExecucaoMs;
    const avg =
      lat.length > 0 ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;
    return {
      volumeExtracaoLinhas: this.volumeExtracaoTotal,
      volumeTransformacaoLinhas: this.volumeTransformacaoTotal,
      volumeCargaLinhas: this.volumeCargaTotal,
      tempoMedioExecucaoMs: avg,
      execucoesRegistradas: this.execucoes.length,
      falhas: this.falhas,
    };
  }

  ultimasExecucoes(limit = 80): EtlExecucao[] {
    return [...this.execucoes].reverse().slice(0, limit);
  }

  filtrarPorFase(fase: EtlFase): EtlExecucao[] {
    return this.execucoes.filter((e) => e.fase === fase);
  }
}
