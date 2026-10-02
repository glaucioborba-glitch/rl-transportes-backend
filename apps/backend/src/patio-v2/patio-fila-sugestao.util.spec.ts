import { rotuloSugestaoPatio, sugerirZonaPatio } from './patio-fila-sugestao.util';

describe('sugerirZonaPatio', () => {
  const livres = new Map([
    ['A2', 4],
    ['B', 2],
    ['C', 0],
  ]);

  it('sem cliente/navio/booking/processo devolve Sem Sugestão', () => {
    const s = sugerirZonaPatio({}, [{ zona: 'A2', unidadeIso: 'CSQU1', clienteId: 'c1' }], livres);
    expect(s).toBeNull();
    expect(rotuloSugestaoPatio(s)).toBe('Sem Sugestão');
  });

  it('segue cliente → navio → booking → processo e exige slot livre', () => {
    const vizinhos = [
      { zona: 'C', unidadeIso: 'AAA', clienteId: 'cli', navio: 'MSC', booking: 'BK1', processo: 'P1' },
      { zona: 'A2', unidadeIso: 'BBB', clienteId: 'cli', navio: 'OUTRO' },
      { zona: 'B', unidadeIso: 'CCC', navio: 'MSC' },
    ];
    const s = sugerirZonaPatio(
      { clienteId: 'cli', navio: 'MSC', booking: 'BK1', processo: 'P1' },
      vizinhos,
      livres,
      'NOVA',
    );
    expect(s).toEqual({ zona: 'A2', motivo: 'cliente' });
  });

  it('se a zona do cliente está lotada, cai no navio', () => {
    const s = sugerirZonaPatio(
      { clienteId: 'cli', navio: 'MSC' },
      [
        { zona: 'C', unidadeIso: 'AAA', clienteId: 'cli' },
        { zona: 'B', unidadeIso: 'BBB', navio: 'MSC' },
      ],
      livres,
    );
    expect(s).toEqual({ zona: 'B', motivo: 'navio' });
  });

  it('casa booking e processo quando os anteriores não servem', () => {
    const s = sugerirZonaPatio(
      { booking: 'BK-9', processo: 'EXP-1' },
      [
        { zona: 'A2', unidadeIso: 'AAA', booking: 'BK-9' },
        { zona: 'B', unidadeIso: 'BBB', processo: 'EXP-1' },
      ],
      livres,
    );
    expect(s).toEqual({ zona: 'A2', motivo: 'booking' });
  });

  it('casa o ID do processo quando o texto do processo veio vazio', () => {
    const s = sugerirZonaPatio(
      { processoNumero: 88 },
      [{ zona: 'B', unidadeIso: 'AAA', processoNumero: 88 }],
      livres,
    );
    expect(s).toEqual({ zona: 'B', motivo: 'processo' });
  });

  it('ignora a própria unidade e zona sem vaga', () => {
    const s = sugerirZonaPatio(
      { clienteId: 'cli' },
      [
        { zona: 'C', unidadeIso: 'MESMA', clienteId: 'cli' },
        { zona: 'A2', unidadeIso: 'MESMA', clienteId: 'cli' },
      ],
      livres,
      'MESMA',
    );
    expect(s).toBeNull();
  });
});
