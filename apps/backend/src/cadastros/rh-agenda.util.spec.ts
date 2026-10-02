import {
  addDaysYmd,
  diffDaysYmd,
  nextOccurrenceYmd,
  nrLabel,
  parseNrs,
  toYmdUtc,
  urgenciaDeDias,
} from './rh-agenda.util';

describe('rh-agenda.util', () => {
  it('converte Date UTC para yyyy-mm-dd', () => {
    expect(toYmdUtc(new Date('2026-03-12T00:00:00.000Z'))).toBe('2026-03-12');
    expect(toYmdUtc('2026-09-29T12:00:00.000Z')).toBe('2026-09-29');
  });

  it('soma dias sem fuso local', () => {
    expect(addDaysYmd('2026-01-01', 90)).toBe('2026-04-01');
    expect(addDaysYmd('2026-01-01', 45)).toBe('2026-02-15');
  });

  it('próximo aniversário no mesmo ano ou no seguinte', () => {
    expect(nextOccurrenceYmd('1990-10-05', '2026-09-29')).toBe('2026-10-05');
    expect(nextOccurrenceYmd('1990-03-01', '2026-09-29')).toBe('2027-03-01');
    expect(nextOccurrenceYmd('1990-09-29', '2026-09-29')).toBe('2026-09-29');
  });

  it('29/02 cai em 28/02 em ano não bissexto', () => {
    expect(nextOccurrenceYmd('2000-02-29', '2025-03-01')).toBe('2026-02-28');
  });

  it('classifica urgência e lê NRs', () => {
    expect(urgenciaDeDias(-2)).toBe('vencido');
    expect(urgenciaDeDias(0)).toBe('hoje');
    expect(urgenciaDeDias(4)).toBe('proximo');
    expect(nrLabel('NR-11')).toContain('empilhadeiras');
    expect(parseNrs([{ codigo: 'NR-35', validade: '2026-12-01' }])).toEqual([
      { codigo: 'NR-35', validade: '2026-12-01' },
    ]);
    expect(diffDaysYmd('2026-09-29', '2026-10-01')).toBe(2);
  });
});
