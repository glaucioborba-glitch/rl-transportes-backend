import { StatusSolicitacao } from '@prisma/client';
import { avaliarSlaOperacional, desempenhoPct, mapStatusCounts } from './dashboard-portal-metrics.util';

describe('dashboard-portal-metrics.util', () => {
  it('mapStatusCounts agrega por status', () => {
    const r = mapStatusCounts([
      { status: StatusSolicitacao.PENDENTE, _count: { _all: 2 } },
      { status: StatusSolicitacao.CONCLUIDO, _count: { _all: 5 } },
    ] as never);
    expect(r.abertas).toBe(2);
    expect(r.concluidas).toBe(5);
    expect(r.total).toBe(7);
  });

  it('avaliarSlaOperacional — dentro do prazo', () => {
    const t0 = new Date('2026-01-01T00:00:00.000Z');
    const p = new Date('2026-01-01T01:00:00.000Z');
    const g = new Date('2026-01-01T02:00:00.000Z');
    const pt = new Date('2026-01-01T10:00:00.000Z');
    const sd = new Date('2026-01-01T12:00:00.000Z');
    const ok = avaliarSlaOperacional(
      t0,
      {
        portaria: { createdAt: p },
        gate: { createdAt: g },
        patio: { createdAt: pt },
        saida: { dataHoraSaida: sd },
      },
      { gate: 24, patio: 72, saida: 24 },
    );
    expect(ok).toBe(true);
  });

  it('desempenhoPct', () => {
    expect(desempenhoPct(8, 2)).toBe(80);
    expect(desempenhoPct(0, 0)).toBe(100);
  });
});
