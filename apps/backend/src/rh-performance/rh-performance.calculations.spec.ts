import type { AvaliacaoRhEntity } from './rh-performance.domain';
import {
  calcularScoreFinalPerformance,
  gerarSugestoesTreinamento,
  mediaPorTurno,
  montarBscScores,
} from './rh-performance.calculations';

describe('rh-performance.calculations', () => {
  it('calcularScoreFinalPerformance usa pesos 40/30/30', () => {
    const r = calcularScoreFinalPerformance({
      notaTecnica: 10,
      notaComportamental: 10,
      aderenciaProcedimentos: 10,
      qualidadeExecucao: 10,
      comprometimento: 10,
    });
    expect(r.scoreFinal).toBe(10);
    const r2 = calcularScoreFinalPerformance({
      notaTecnica: 0,
      notaComportamental: 0,
      aderenciaProcedimentos: 0,
      qualidadeExecucao: 0,
      comprometimento: 0,
    });
    expect(r2.scoreFinal).toBe(0);
  });

  it('mediaPorTurno agrupa corretamente', () => {
    const avs: AvaliacaoRhEntity[] = [
      {
        id: '1',
        colaboradorId: 'a',
        turnoReferencia: 'MANHA',
        periodo: '2026-04',
        avaliador: 'x',
        notaTecnica: 8,
        notaComportamental: 8,
        aderenciaProcedimentos: 8,
        qualidadeExecucao: 8,
        comprometimento: 8,
        scoreFinal: 8,
        createdAt: '',
      },
      {
        id: '2',
        colaboradorId: 'b',
        turnoReferencia: 'MANHA',
        periodo: '2026-04',
        avaliador: 'x',
        notaTecnica: 6,
        notaComportamental: 6,
        aderenciaProcedimentos: 6,
        qualidadeExecucao: 6,
        comprometimento: 6,
        scoreFinal: 6,
        createdAt: '',
      },
    ];
    expect(mediaPorTurno(avs).MANHA).toBe(7);
  });

  it('montarBscScores retorna quatro perspectivas', () => {
    const b = montarBscScores({
      custoOperacaoProxy: 50000,
      taxaFalhasProxy: 5,
      npsInternoProxy: 8,
      horasTreinamentoRealizadas: 60,
      metaHorasTreino: 120,
    });
    expect(Object.keys(b).length).toBe(4);
  });

  it('gerarSugestoesTreinamento sugere técnico quando nota baixa', () => {
    const m = new Map<string, AvaliacaoRhEntity[]>();
    m.set('c1', [
      {
        id: '1',
        colaboradorId: 'c1',
        periodo: '2026-04',
        avaliador: 'g',
        notaTecnica: 4,
        notaComportamental: 8,
        aderenciaProcedimentos: 8,
        qualidadeExecucao: 8,
        comprometimento: 8,
        scoreFinal: 7,
        createdAt: '',
      },
    ]);
    const s = gerarSugestoesTreinamento({ avaliacoesPorColaborador: m, retrabalhoPctProxy: 3 });
    expect(s.some((x) => x.moduloSugerido.includes('tecnica'))).toBe(true);
  });
});
