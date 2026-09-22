import { StatusSolicitacao } from '@prisma/client';
import {
  avaliarSlaOperacional,
  boletoStatusAberto,
  dayBoundsInTimeZone,
  desempenhoPct,
  mapStatusCounts,
  utcDateOnly,
} from './dashboard-portal-metrics.util';

describe('dashboard-portal-metrics.util', () => {
  it('mapStatusCounts agrega por status', () => {
    const r = mapStatusCounts([
      { status: StatusSolicitacao.PENDENTE, _count: { _all: 2 } },
      { status: StatusSolicitacao.CONCLUIDO, _count: { _all: 5 } },
      { status: StatusSolicitacao.CANCELADO_CLIENTE, _count: { _all: 1 } },
    ] as never);
    expect(r.abertas).toBe(2);
    expect(r.concluidas).toBe(5);
    expect(r.canceladas).toBe(1);
    expect(r.total).toBe(8);
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
      { gate: 240, patio: 4320, saida: 1440 },
    );
    expect(ok).toBe(true);
  });

  it('desempenhoPct', () => {
    expect(desempenhoPct(8, 2)).toBe(80);
    expect(desempenhoPct(0, 0)).toBe(100);
  });

  it('boletoStatusAberto ignora pago e cancelado', () => {
    expect(boletoStatusAberto('pago')).toBe(false);
    expect(boletoStatusAberto('CANCELADO')).toBe(false);
    expect(boletoStatusAberto('pendente')).toBe(true);
    expect(boletoStatusAberto('vencido')).toBe(true);
  });

  it('dayBoundsInTimeZone usa calendário de São Paulo', () => {
    const ref = new Date('2026-09-19T06:00:00.000Z');
    const { ymd, start, end } = dayBoundsInTimeZone(ref);
    expect(ymd).toBe('2026-09-19');
    expect(utcDateOnly(ymd).toISOString()).toBe('2026-09-19T00:00:00.000Z');
    expect(start.toISOString()).toBe('2026-09-19T03:00:00.000Z');
    expect(end.getTime()).toBe(new Date('2026-09-20T02:59:59.999Z').getTime());
  });
});
