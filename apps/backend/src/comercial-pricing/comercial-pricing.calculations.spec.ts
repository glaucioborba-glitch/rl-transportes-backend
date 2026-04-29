import {
  curvaAbcAcumuladoLucroOrdemFixa,
  curvaAbcPorLucratividade,
  elasticidadeDemandaPreco,
  simuladorComercial,
} from './comercial-pricing.calculations';

describe('comercial-pricing.calculations', () => {
  describe('curvaAbcAcumuladoLucroOrdemFixa', () => {
    it('aplica pareto sobre lucro na ordem dos elementos sem resort por valor absoluto', () => {
      const out = curvaAbcAcumuladoLucroOrdemFixa([
        { id: 'first', lucro: 100 },
        { id: 'second', lucro: 900 },
      ]);
      expect(out[0].contribuicaoLucroAcumPct).toBeLessThan(out[1].contribuicaoLucroAcumPct);
      expect(out[1].contribuicaoLucroAcumPct).toBe(100);
    });
  });

  describe('curvaAbcPorLucratividade', () => {
    it('distribui A/B/C pelo cumulativo do lucro positivo', () => {
      const rows = [
        { id: '1', lucro: 800 },
        { id: '2', lucro: 150 },
        { id: '3', lucro: 50 },
      ];
      const out = curvaAbcPorLucratividade(rows);
      expect(out[0].classe).toBe('A');
      expect(out[0].id).toBe('1');
      expect(out[1].classe).toBe('B');
      expect(out[2].classe).toBe('C');
    });

    it('retorna C quando não há lucro positivo total', () => {
      const out = curvaAbcPorLucratividade([
        { id: 'a', lucro: -10 },
        { id: 'b', lucro: -5 },
      ]);
      expect(out.every((x) => x.classe === 'C')).toBe(true);
    });
  });

  describe('elasticidadeDemandaPreco', () => {
    it('calcula média de razões volume/preço entre meses', () => {
      const e = elasticidadeDemandaPreco([
        { mes: '2026-01', volume: 100, precoMedio: 200 },
        { mes: '2026-02', volume: 90, precoMedio: 220 },
      ]);
      expect(e).not.toBeNull();
      expect(e!).toBeLessThan(0);
    });

    it('retorna null para série curta ou inválida', () => {
      expect(elasticidadeDemandaPreco([])).toBeNull();
      expect(elasticidadeDemandaPreco([{ mes: 'a', volume: 1, precoMedio: 1 }])).toBeNull();
    });
  });

  describe('simuladorComercial', () => {
    it('projeta margem e volume com elasticidade default', () => {
      const r = simuladorComercial({
        precoAtual: 100,
        precoNovo: 110,
        custo: 60,
        volumeAtual: 1000,
      });
      expect(r.margemAtual).toBeCloseTo(0.4, 5);
      expect(r.margemNova).toBeCloseTo((110 - 60) / 110, 3);
      expect(r.impactoVolumeEstimado).toBeLessThan(0);
    });
  });
});
