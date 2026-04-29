import { avaliarCondicoes, avaliarExpressaoRegra, transicaoEstadoPermitida, valorDoCampo } from './automacao-rule-engine';

describe('automacao-rule-engine', () => {
  it('valorDoCampo resolve aninhado', () => {
    expect(valorDoCampo({ a: { b: 2 } }, 'a.b')).toBe(2);
  });

  it('avaliarCondicoes eq e gt', () => {
    const p = { container: { tipo: 'reefer' }, valor: 1500 };
    expect(
      avaliarCondicoes(p, [
        { campo: 'container.tipo', op: 'eq', valor: 'reefer' },
        { campo: 'valor', op: 'gt', valor: 1000 },
      ]),
    ).toBe(true);
  });

  it('avaliarExpressaoRegra gt e eq', () => {
    expect(avaliarExpressaoRegra('container.stay_hours>72', { container: { stay_hours: 80 } })).toBe(true);
    expect(avaliarExpressaoRegra("container.tipo=reefer", { container: { tipo: 'reefer' } })).toBe(true);
  });

  it('transicaoEstadoPermitida segue ISO', () => {
    expect(transicaoEstadoPermitida('criado', 'portaria')).toBe(true);
    expect(transicaoEstadoPermitida('criado', 'patio')).toBe(false);
  });
});
