import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AvaliacaoRhEntity } from './rh-performance.domain';
import {
  calcularScoreFinalPerformance,
  gerarSugestoesTreinamento,
  mediaPorTurno,
  mediaScoresAvaliacoes,
  montarBscScores,
  type PerspectivaBsc,
} from './rh-performance.calculations';
import { RhPerformanceStoreService } from './rh-performance-store.service';
import type {
  AvaliacaoRhRespostaDto,
  BaselineCargoDto,
  BscPerspectivaDto,
  BscRhRespostaDto,
  DashboardRhPerformanceDto,
  OkrRhRespostaDto,
  RhKpisRespostaDto,
  SugestaoTreinamentoRhDto,
  TreinamentoRhRespostaDto,
} from './dto/rh-performance-response.dto';
import type {
  CreateAvaliacaoRhDto,
  CreateOkrRhDto,
  CreateTreinamentoRhDto,
} from './dto/rh-performance.dto';

@Injectable()
export class RhPerformanceService {
  constructor(
    private readonly store: RhPerformanceStoreService,
    private readonly config: ConfigService,
  ) {}

  private numEnv(key: string, fallback: number): number {
    const v = parseFloat(this.config.get<string>(key) ?? '');
    return Number.isFinite(v) ? v : fallback;
  }

  createAvaliacao(dto: CreateAvaliacaoRhDto): AvaliacaoRhRespostaDto {
    const calc = calcularScoreFinalPerformance({
      notaTecnica: dto.notaTecnica,
      notaComportamental: dto.notaComportamental,
      aderenciaProcedimentos: dto.aderenciaProcedimentos,
      qualidadeExecucao: dto.qualidadeExecucao,
      comprometimento: dto.comprometimento,
    });
    const e = this.store.createAvaliacao({
      colaboradorId: dto.colaboradorId,
      turnoReferencia: dto.turnoReferencia,
      cargoReferencia: dto.cargoReferencia?.trim(),
      periodo: dto.periodo,
      avaliador: dto.avaliador.trim(),
      notaTecnica: dto.notaTecnica,
      notaComportamental: dto.notaComportamental,
      aderenciaProcedimentos: dto.aderenciaProcedimentos,
      qualidadeExecucao: dto.qualidadeExecucao,
      comprometimento: dto.comprometimento,
      comentarioGerencial: dto.comentarioGerencial?.trim(),
      scoreFinal: calc.scoreFinal,
    });
    return this.mapAvaliacao(e);
  }

  listAvaliacoes(): AvaliacaoRhRespostaDto[] {
    return this.store.listAvaliacoes().map((a) => this.mapAvaliacao(a));
  }

  private mapAvaliacao(a: AvaliacaoRhEntity): AvaliacaoRhRespostaDto {
    return {
      id: a.id,
      colaboradorId: a.colaboradorId,
      turnoReferencia: a.turnoReferencia,
      cargoReferencia: a.cargoReferencia,
      periodo: a.periodo,
      avaliador: a.avaliador,
      notaTecnica: a.notaTecnica,
      notaComportamental: a.notaComportamental,
      aderenciaProcedimentos: a.aderenciaProcedimentos,
      qualidadeExecucao: a.qualidadeExecucao,
      comprometimento: a.comprometimento,
      comentarioGerencial: a.comentarioGerencial,
      scoreFinal: a.scoreFinal,
      createdAt: a.createdAt,
    };
  }

  createOkr(dto: CreateOkrRhDto): OkrRhRespostaDto {
    const e = this.store.createOkr({
      objetivo: dto.objetivo.trim(),
      escopo: dto.escopo,
      keyResults: dto.keyResults.map((s) => s.trim()).filter(Boolean),
      progressoAtual: dto.progressoAtual,
      periodoInicio: dto.periodoInicio.slice(0, 10),
      periodoFim: dto.periodoFim.slice(0, 10),
      responsavel: dto.responsavel.trim(),
    });
    return { ...e };
  }

  listOkrs(): OkrRhRespostaDto[] {
    return this.store.listOkrs().map((o) => ({ ...o }));
  }

  createTreinamento(dto: CreateTreinamentoRhDto): TreinamentoRhRespostaDto {
    const e = this.store.createTreinamento({
      colaboradorId: dto.colaboradorId,
      modulo: dto.modulo.trim(),
      cargaHoraria: dto.cargaHoraria,
      status: dto.status,
      dataConclusao: dto.dataConclusao?.slice(0, 10),
    });
    return { ...e };
  }

  listTreinamentos(): TreinamentoRhRespostaDto[] {
    return this.store.listTreinamentos().map((t) => ({ ...t }));
  }

  getKpis(): RhKpisRespostaDto {
    const avs = this.store.listAvaliacoes();
    const baselinePorTurno = mediaPorTurno(avs);

    const porCargo = new Map<string, number[]>();
    for (const a of avs) {
      const c = a.cargoReferencia?.trim() || 'NAO_INFORMADO';
      porCargo.set(c, [...(porCargo.get(c) ?? []), a.scoreFinal]);
    }
    const baselinePorCargo: BaselineCargoDto[] = [...porCargo.entries()].map(([cargo, vals]) => ({
      cargo,
      scoreMedio: Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 1000) / 1000,
      amostras: vals.length,
    }));

    return {
      absenteismoPct: this.numEnv('RH_PERF_ABSENTEISMO_PCT', 4.5),
      turnoverPct: this.numEnv('RH_PERF_TURNOVER_PCT', 15),
      mediaHorasExtrasPorColaborador: this.numEnv('RH_PERF_HE_MEDIA_HORAS', 5.5),
      produtividadePorTurno: {
        MANHA: this.numEnv('RH_PERF_PRODUTIVIDADE_IA_MANHA', 82),
        TARDE: this.numEnv('RH_PERF_PRODUTIVIDADE_IA_TARDE', 78),
        NOITE: this.numEnv('RH_PERF_PRODUTIVIDADE_IA_NOITE', 74),
      },
      retrabalhoOperacionalPct: this.numEnv('RH_PERF_RETRABALHO_PCT', 6),
      aderenciaSlaPct: this.numEnv('RH_PERF_SLA_ADERENCIA_PCT', 91),
      custoMoPorOperacao: this.numEnv('RH_PERF_CUSTO_MO_OPERACAO', 52000),
      baselinePorCargo,
      baselinePorTurno,
    };
  }

  getBsc(): BscRhRespostaDto {
    const horasRealizadas = this.store
      .listTreinamentos()
      .filter((t) => t.status === 'concluido')
      .reduce((s, t) => s + t.cargaHoraria, 0);

    const metaHorasMes = this.numEnv('RH_PERF_META_HORAS_TREINO_MES', 120);

    const avs = this.store.listAvaliacoes();
    const npsInternoProxy =
      avs.length === 0
        ? this.numEnv('RH_PERF_NPS_INTERNO_DEFAULT', 72) / 10
        : mediaScoresAvaliacoes(avs);

    const custoOp = this.numEnv('RH_PERF_CUSTO_MO_OPERACAO', 52000);
    const taxaFalhas = this.numEnv('RH_PERF_TAXA_FALHAS_OP_PCT', 4);

    const raw = montarBscScores({
      custoOperacaoProxy: custoOp,
      taxaFalhasProxy: taxaFalhas,
      npsInternoProxy,
      horasTreinamentoRealizadas: horasRealizadas,
      metaHorasTreino: metaHorasMes,
    });

    const nomePersp: Record<PerspectivaBsc, string> = {
      financeira: 'Financeira',
      processos_internos: 'Processos Internos',
      cliente: 'Cliente',
      aprendizado_crescimento: 'Aprendizado & Crescimento',
    };

    const perspectivas: BscPerspectivaDto[] = (
      Object.entries(raw) as [PerspectivaBsc, number][]
    ).map(([k, score]) => {
      let detalhes: Record<string, number>;
      if (k === 'financeira') detalhes = { custoMoPorOperacao: custoOp };
      else if (k === 'processos_internos') detalhes = { taxaFalhasOperacionais: taxaFalhas };
      else if (k === 'cliente') detalhes = { npsInternoProxy: npsInternoProxy * 10 };
      else detalhes = { horasTreinamentoRealizadas: horasRealizadas, metaHorasTreinoMes: metaHorasMes };
      return {
        nome: nomePersp[k],
        score,
        detalhes,
      };
    });

    const vals = Object.values(raw);
    const scoreGlobal =
      vals.length === 0 ? 0 : Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;

    return { perspectivas, scoreGlobal };
  }

  getSugestoesTreinamento(): SugestaoTreinamentoRhDto[] {
    const map = new Map<string, AvaliacaoRhEntity[]>();
    for (const a of this.store.listAvaliacoes()) {
      map.set(a.colaboradorId, [...(map.get(a.colaboradorId) ?? []), a]);
    }
    const retrabalho = this.numEnv('RH_PERF_RETRABALHO_PCT', 6);
    return gerarSugestoesTreinamento({
      avaliacoesPorColaborador: map,
      retrabalhoPctProxy: retrabalho,
    }).map((s) => ({ ...s }));
  }

  getDashboard(): DashboardRhPerformanceDto {
    const avs = this.store.listAvaliacoes();
    const notaMediaGlobal = mediaScoresAvaliacoes(avs);
    const mt = mediaPorTurno(avs);
    const eficienciaPorTurno: Record<string, number> = {};
    for (const [k, v] of Object.entries(mt)) {
      eficienciaPorTurno[k] = Math.min(100, Math.round(v * 10 * 100) / 100);
    }

    const horasTreinamentoRealizadas = this.store
      .listTreinamentos()
      .filter((t) => t.status === 'concluido')
      .reduce((s, t) => s + t.cargaHoraria, 0);

    const gaps: string[] = [];
    if (notaMediaGlobal < 7) gaps.push('Nota média global abaixo de 7 — revisar metas e capacitação.');
    const lowTech = avs.filter((a) => a.notaTecnica < 6).length;
    if (lowTech > 0) gaps.push(`${lowTech} avaliações com nota técnica < 6.`);

    const periodos = [...new Set(avs.map((a) => a.periodo))].sort();
    let tendencia: 'subindo' | 'estavel' | 'caindo' = 'estavel';
    if (periodos.length >= 2) {
      const pLast = periodos[periodos.length - 1];
      const pPrev = periodos[periodos.length - 2];
      const avgLast =
        avs.filter((a) => a.periodo === pLast).reduce((s, a) => s + a.scoreFinal, 0) /
        Math.max(1, avs.filter((a) => a.periodo === pLast).length);
      const avgPrev =
        avs.filter((a) => a.periodo === pPrev).reduce((s, a) => s + a.scoreFinal, 0) /
        Math.max(1, avs.filter((a) => a.periodo === pPrev).length);
      if (avgLast > avgPrev + 0.15) tendencia = 'subindo';
      else if (avgLast < avgPrev - 0.15) tendencia = 'caindo';
    }

    const mapaCompetencias: Record<string, number> = {};
    const cargoMap = new Map<string, number[]>();
    for (const a of avs) {
      const c = a.cargoReferencia?.trim() || 'NAO_INFORMADO';
      cargoMap.set(c, [...(cargoMap.get(c) ?? []), a.scoreFinal]);
    }
    for (const [c, vals] of cargoMap.entries()) {
      mapaCompetencias[c] =
        Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 1000) / 1000;
    }

    const okrs = this.store.listOkrs();
    const okrProgressoMedioPct =
      okrs.length === 0
        ? 0
        : Math.round((okrs.reduce((s, o) => s + o.progressoAtual, 0) / okrs.length) * 100) / 100;

    return {
      notaMediaGlobal,
      eficienciaPorTurno,
      horasTreinamentoRealizadas,
      gapsIdentificados: gaps,
      tendenciaPerformance: tendencia,
      riscoTalentosCriticos: this.numEnv('RH_PERF_RISCO_TALENTOS', 38),
      mapaCompetencias,
      okrProgressoMedioPct,
    };
  }
}
