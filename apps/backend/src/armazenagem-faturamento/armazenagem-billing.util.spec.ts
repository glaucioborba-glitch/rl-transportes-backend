import { computeProvision, diffDiasCalendario } from './armazenagem-billing.util';

describe('diffDiasCalendario', () => {
  it('conta o dia da chegada (mesmo dia = 1)', () => {
    const chegada = new Date('2026-09-07T15:00:00.000-03:00');
    expect(diffDiasCalendario(chegada, chegada)).toBe(1);
    expect(diffDiasCalendario(chegada, new Date('2026-09-07T23:50:00.000-03:00'))).toBe(1);
  });

  it('7 dias free: 07/09 a 13/09 = 7; 14/09 é o 8º dia (1ª diária)', () => {
    const chegada = new Date('2026-09-07T10:00:00.000-03:00');
    expect(diffDiasCalendario(chegada, new Date('2026-09-13T18:00:00.000-03:00'))).toBe(7);
    expect(diffDiasCalendario(chegada, new Date('2026-09-14T09:00:00.000-03:00'))).toBe(8);
    expect(diffDiasCalendario(chegada, new Date('2026-09-28T18:00:00.000-03:00'))).toBe(22);
  });
});

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
