import { computeProvision } from './armazenagem-billing.util';

describe('computeProvision', () => {
  const gateIn = new Date('2026-06-01T14:00:00.000Z');

  it('não cobra dentro do free time', () => {
    const asOf = new Date('2026-06-05T10:00:00.000Z');
    const r = computeProvision(gateIn, asOf, 5, 85, 120);
    expect(r.diasEstadia).toBe(4);
    expect(r.diasCobrados).toBe(0);
    expect(r.valorAcumulado).toBe(0);
    expect(r.cobrancaInicioEm).toBeNull();
  });

  it('cobra diárias + serviços extras após free time', () => {
    const asOf = new Date('2026-06-08T10:00:00.000Z');
    const r = computeProvision(gateIn, asOf, 5, 85, 120);
    expect(r.diasEstadia).toBe(7);
    expect(r.diasCobrados).toBe(2);
    expect(r.valorAcumulado).toBe(290);
    expect(r.cobrancaInicioEm).not.toBeNull();
  });
});
