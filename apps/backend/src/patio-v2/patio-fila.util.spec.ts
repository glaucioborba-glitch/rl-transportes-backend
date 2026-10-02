import {
  comparePatioFila,
  parsePatioZonaPosicao,
  posicoesOrdemVisual,
  rotuloPosicaoPatio,
  sortPatioFila,
} from './patio-fila.util';

describe('patio-fila.util', () => {
  it('ordena por urgência e FIFO dentro do grupo', () => {
    const items = [
      { id: 'n2', urgencia: 'NORMAL', criadoEm: '2026-10-01T12:00:00.000Z' },
      { id: 'p1', urgencia: 'PRIORITARIO', criadoEm: '2026-10-01T12:05:00.000Z' },
      { id: 'f2', urgencia: 'PREFERENCIAL', criadoEm: '2026-10-01T12:02:00.000Z' },
      { id: 'n1', urgencia: 'NORMAL', criadoEm: '2026-10-01T11:00:00.000Z' },
      { id: 'p2', urgencia: 'PRIORITARIO', criadoEm: '2026-10-01T12:10:00.000Z' },
      { id: 'f1', urgencia: 'PREFERENCIAL', criadoEm: '2026-10-01T11:50:00.000Z' },
    ];
    expect(sortPatioFila(items).map((i) => i.id)).toEqual(['p1', 'p2', 'f1', 'f2', 'n1', 'n2']);
  });

  it('lê zona e posição do código', () => {
    expect(parsePatioZonaPosicao('A-5')).toEqual({ zona: 'A', posicao: 5 });
    expect(parsePatioZonaPosicao('A1-5')).toEqual({ zona: 'A1', posicao: 5 });
    expect(parsePatioZonaPosicao('B7-12')).toEqual({ zona: 'B7', posicao: 12 });
    expect(parsePatioZonaPosicao('B12')).toEqual({ zona: 'B', posicao: 12 });
    expect(parsePatioZonaPosicao('A01')).toEqual({ zona: 'A', posicao: 1 });
    expect(parsePatioZonaPosicao('')).toBeNull();
  });

  it('desenha a grade de baixo para cima em cada coluna', () => {
    expect(posicoesOrdemVisual()).toEqual([3, 6, 9, 12, 2, 5, 8, 11, 1, 4, 7, 10]);
    expect(rotuloPosicaoPatio(1)).toBe('01');
  });

  it('coloca o recém-enviado por último no mesmo grupo', () => {
    const a = { urgencia: 'PREFERENCIAL', criadoEm: '2026-10-01T10:00:00.000Z' };
    const b = { urgencia: 'PREFERENCIAL', criadoEm: '2026-10-01T10:01:00.000Z' };
    expect(comparePatioFila(a, b)).toBeLessThan(0);
  });
});
