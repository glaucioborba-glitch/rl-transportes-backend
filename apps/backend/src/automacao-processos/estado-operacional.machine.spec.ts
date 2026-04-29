import { inferirEstadoOperacional, listarGraficoEstados, validarTransicaoIso } from './estado-operacional.machine';

describe('estado-operacional.machine', () => {
  it('inferirEstadoOperacional por flags', () => {
    expect(
      inferirEstadoOperacional({
        temPortaria: false,
        temGate: false,
        temPatio: false,
        temSaida: false,
      }),
    ).toBe('criado');
    expect(
      inferirEstadoOperacional({
        temPortaria: true,
        temGate: false,
        temPatio: false,
        temSaida: false,
      }),
    ).toBe('portaria');
    expect(
      inferirEstadoOperacional({
        temPortaria: true,
        temGate: true,
        temPatio: true,
        temSaida: false,
      }),
    ).toBe('patio');
    expect(
      inferirEstadoOperacional({
        temPortaria: true,
        temGate: true,
        temPatio: true,
        temSaida: true,
      }),
    ).toBe('finalizado');
  });

  it('validarTransicaoIso', () => {
    expect(validarTransicaoIso('patio', 'gate-out')).toBe(true);
    expect(validarTransicaoIso('patio', 'portaria')).toBe(false);
  });

  it('listarGraficoEstados cobre ordem', () => {
    const g = listarGraficoEstados();
    expect(g[0].estado).toBe('criado');
    expect(g[g.length - 1].estado).toBe('finalizado');
  });
});
