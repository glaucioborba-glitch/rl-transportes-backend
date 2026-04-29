import { Injectable } from '@nestjs/common';
import { IaPreditivaMlopsStore } from './ia-preditiva-mlops.store';
import { IaPreditivaDemandaService } from './services/ia-preditiva-demanda.service';
import { IaPreditivaOcupacaoService } from './services/ia-preditiva-ocupacao.service';
import { IaPreditivaProdutividadeService } from './services/ia-preditiva-produtividade.service';
import { IaPreditivaInadimplenciaService } from './services/ia-preditiva-inadimplencia.service';

@Injectable()
export class IaPreditivaService {
  constructor(
    private readonly mlops: IaPreditivaMlopsStore,
    private readonly demanda: IaPreditivaDemandaService,
    private readonly ocupacao: IaPreditivaOcupacaoService,
    private readonly produtividade: IaPreditivaProdutividadeService,
    private readonly inadimplencia: IaPreditivaInadimplenciaService,
  ) {}

  async treinar(): Promise<{
    demanda: { mesesUsados: number; cv: number };
    ocupacao: { phi: number };
    produtividade: { horasDia: number };
    inadimplencia: { pesos: number[] };
    persistencia: { ok: boolean; caminho?: string };
    versao: string;
    ultimaAtualizacao: string | null;
    qualidadeProxyPct: number;
  }> {
    const demanda = await this.demanda.treinar();
    const ocupacao = await this.ocupacao.treinar();
    const produtividade = await this.produtividade.treinar();
    const inadimplencia = await this.inadimplencia.treinar();
    this.mlops.touchTreino();
    const persistencia = this.mlops.persistirOpcional();
    return {
      demanda,
      ocupacao,
      produtividade,
      inadimplencia,
      persistencia,
      versao: this.mlops.versao,
      ultimaAtualizacao: this.mlops.ultimaAtualizacao,
      qualidadeProxyPct: this.mlops.qualidadeProxyPct,
    };
  }

  modelos() {
    return {
      geradoEm: new Date().toISOString(),
      versaoPipeline: this.mlops.versao,
      ultimaAtualizacao: this.mlops.ultimaAtualizacao,
      qualidadeProxyPct: this.mlops.qualidadeProxyPct,
      modelos: [
        {
          id: 'demanda_volume',
          descricao: 'Regressão linear + SES + sazonalidade mensal + proxy dias úteis',
          parametrosChave: ['sesAlpha', 'blendTrend'],
          valores: { sesAlpha: this.mlops.sesAlpha, blendTrend: this.mlops.blendTrend },
        },
        {
          id: 'ocupacao_patio',
          descricao: 'Regressão série mensal entradas + capacidade configurável + φ AR(1)',
          parametrosChave: ['ocupacaoPhi', 'capacidadeEnv'],
          valores: { ocupacaoPhi: this.mlops.ocupacaoPhi },
        },
        {
          id: 'produtividade_uph',
          descricao: 'Regressão semanal de conclusões / horas efectivas',
          parametrosChave: ['prodHorasEfectivasPorDia'],
          valores: { prodHorasEfectivasPorDia: this.mlops.prodHorasEfectivasPorDia },
        },
        {
          id: 'inadimplencia_scorecard',
          descricao: 'Logística score σ(z) — atraso, ABC, volume',
          parametrosChave: ['pesosInadimplencia'],
          valores: { pesosInadimplencia: [...this.mlops.pesosInadimplencia] },
        },
        {
          id: 'anomalias_heuristica',
          descricao: 'Z-score faturamento + regras ISO/gate/horário (sem ML externo)',
          parametrosChave: ['IA_PRED_ANOM_Z', 'IA_PRED_HORA_UTIL_INI/FIM'],
          valores: {},
        },
      ],
    };
  }
}
