import type { AvaliacaoRhEntity } from './rh-performance.domain';

/** 40% operacional + 30% comportamental + 30% técnica (ver Swagger). */
export function calcularScoreFinalPerformance(input: {
  notaTecnica: number;
  notaComportamental: number;
  aderenciaProcedimentos: number;
  qualidadeExecucao: number;
  comprometimento: number;
}): {
  scoreFinal: number;
  mediaOperacional: number;
  mediaComportamental: number;
  notaTecnica: number;
} {
  const mediaOperacional = (input.aderenciaProcedimentos + input.qualidadeExecucao) / 2;
  const mediaComportamental = (input.notaComportamental + input.comprometimento) / 2;
  const notaTecnica = input.notaTecnica;
  const scoreFinal =
    Math.round((0.4 * mediaOperacional + 0.3 * mediaComportamental + 0.3 * notaTecnica) * 1000) /
    1000;
  return { scoreFinal, mediaOperacional, mediaComportamental, notaTecnica };
}

export function mediaScoresAvaliacoes(avs: AvaliacaoRhEntity[]): number {
  if (avs.length === 0) return 0;
  const s = avs.reduce((a, v) => a + v.scoreFinal, 0);
  return Math.round((s / avs.length) * 1000) / 1000;
}

export function mediaPorTurno(avs: AvaliacaoRhEntity[]): Record<string, number> {
  const buckets: Record<string, number[]> = {};
  for (const a of avs) {
    const k = a.turnoReferencia ?? 'NAO_INFORMADO';
    buckets[k] = buckets[k] ?? [];
    buckets[k].push(a.scoreFinal);
  }
  const out: Record<string, number> = {};
  for (const [k, vals] of Object.entries(buckets)) {
    out[k] =
      vals.length === 0
        ? 0
        : Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 1000) / 1000;
  }
  return out;
}

export interface SugestaoTreinamento {
  colaboradorId: string;
  moduloSugerido: string;
  motivo: string;
  prioridade: 'alta' | 'media' | 'baixa';
}

export function gerarSugestoesTreinamento(input: {
  avaliacoesPorColaborador: Map<string, AvaliacaoRhEntity[]>;
  retrabalhoPctProxy: number;
}): SugestaoTreinamento[] {
  const out: SugestaoTreinamento[] = [];
  for (const [colabId, lista] of input.avaliacoesPorColaborador) {
    const ultima = lista.sort((a, b) => b.periodo.localeCompare(a.periodo))[0];
    if (!ultima) continue;

    if (ultima.notaTecnica < 6) {
      out.push({
        colaboradorId: colabId,
        moduloSugerido: 'operacao_tecnica_reciclagem',
        motivo: 'Nota técnica abaixo de 6 — reforço técnico recomendado.',
        prioridade: 'alta',
      });
    }
    if ((ultima.notaComportamental + ultima.comprometimento) / 2 < 6) {
      out.push({
        colaboradorId: colabId,
        moduloSugerido: 'comportamento_equipes',
        motivo: 'Dimensão comportamental/comprometimento baixa.',
        prioridade: 'media',
      });
    }
    if (input.retrabalhoPctProxy > 8 && ultima.qualidadeExecucao < 7) {
      out.push({
        colaboradorId: colabId,
        moduloSugerido: 'qualidade_procedimentos_nr',
        motivo: 'Alto retrabalho proxy operacional + qualidade de execução aquém do esperado.',
        prioridade: 'alta',
      });
    }
  }
  return out;
}

export type PerspectivaBsc = 'financeira' | 'processos_internos' | 'cliente' | 'aprendizado_crescimento';

export function montarBscScores(input: {
  custoOperacaoProxy: number;
  taxaFalhasProxy: number;
  npsInternoProxy: number;
  horasTreinamentoRealizadas: number;
  metaHorasTreino: number;
}): Record<PerspectivaBsc, number> {
  const fin = Math.min(
    100,
    Math.max(0, 100 - Math.min(100, input.custoOperacaoProxy / 1000)),
  );
  const proc = Math.min(100, Math.max(0, 100 - input.taxaFalhasProxy * 5));
  const cli = Math.min(100, Math.max(0, input.npsInternoProxy * 10));
  const ap =
    input.metaHorasTreino <= 0
      ? 50
      : Math.min(100, (input.horasTreinamentoRealizadas / input.metaHorasTreino) * 100);
  return {
    financeira: Math.round(fin * 100) / 100,
    processos_internos: Math.round(proc * 100) / 100,
    cliente: Math.round(cli * 100) / 100,
    aprendizado_crescimento: Math.round(ap * 100) / 100,
  };
}
