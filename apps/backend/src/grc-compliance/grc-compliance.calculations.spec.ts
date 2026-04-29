import {
  calcularIndicesCertificacao,
  calcularScoreCompliance,
  listarGapsCertificacao,
  mapaRiscoCorporativoPorSeveridade,
  mediaEficaciaControles,
  plano5w2hSugeridoParaGaps,
  severidadeRisco,
  type IncidenteComplianceCalc,
} from './grc-compliance.calculations';

describe('grc-compliance.calculations', () => {
  describe('severidadeRisco', () => {
    it('calcula probabilidade × impacto', () => {
      expect(severidadeRisco(3, 4)).toBe(12);
      expect(severidadeRisco(5, 5)).toBe(25);
    });
  });

  describe('mediaEficaciaControles', () => {
    it('retorna null para lista vazia', () => {
      expect(mediaEficaciaControles([])).toBeNull();
    });

    it('calcula média arredondada a 2 casas', () => {
      expect(mediaEficaciaControles([80, 90])).toBe(85);
      expect(mediaEficaciaControles([33, 33, 34])).toBe(33.33);
    });
  });

  describe('calcularScoreCompliance', () => {
    it('sem incidentes retorna 100', () => {
      expect(calcularScoreCompliance([])).toBe(100);
    });

    it('penaliza incidentes e mantém 0–100', () => {
      const inc: IncidenteComplianceCalc[] = [
        {
          codigo: 'X',
          severidade: 'critica',
          area: 'A',
          descricao: 'd',
          fonteDados: 't',
        },
      ];
      const score = calcularScoreCompliance(inc);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calcularIndicesCertificacao / listarGapsCertificacao / plano5w2h', () => {
    it('calcula índices limitados a 100', () => {
      const idx = calcularIndicesCertificacao({
        eficaciaMediaControles: 80,
        scoreCompliance: 70,
        pctRiscosMitigadosOuControlados: 90,
      });
      expect(idx.indiceAderenciaISO).toBeLessThanOrEqual(100);
      expect(idx.indiceAderenciaOEA).toBeLessThanOrEqual(100);
      expect(idx.indiceAderenciaISPS).toBeLessThanOrEqual(100);
    });

    it('lista gaps quando índices abaixo do limiar', () => {
      const gaps = listarGapsCertificacao({
        indiceAderenciaISO: 70,
        indiceAderenciaOEA: 70,
        indiceAderenciaISPS: 70,
      });
      expect(gaps.length).toBeGreaterThanOrEqual(3);
    });

    it('plano 5W2H sugere estrutura completa', () => {
      const p = plano5w2hSugeridoParaGaps('ISO 9001');
      expect(p.what).toContain('ISO');
      expect(p.why).toBeTruthy();
      expect(p.howMuch).toBe(0);
    });
  });

  describe('mapaRiscoCorporativoPorSeveridade', () => {
    it('agrupa severidades em faixas', () => {
      const m = mapaRiscoCorporativoPorSeveridade([4, 10, 15, 24]);
      expect(m['1-6']).toBe(1);
      expect(m['7-12']).toBe(1);
      expect(m['13-18']).toBe(1);
      expect(m['19-25']).toBe(1);
    });
  });
});
