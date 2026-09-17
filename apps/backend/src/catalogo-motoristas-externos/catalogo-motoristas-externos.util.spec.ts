import {
  isCpfFrotaPlaceholder,
  motoristaEstaSuspenso,
  normalizeMotoristaCpf,
  suspensoAteEm,
} from './catalogo-motoristas-externos.util';

describe('catalogo-motoristas-externos.util', () => {
  it('normaliza CPF com máscara', () => {
    expect(normalizeMotoristaCpf('390.533.447-05')).toBe('39053344705');
  });

  it('ignora o CPF placeholder da frota FL', () => {
    expect(isCpfFrotaPlaceholder('000.000.000-00')).toBe(true);
    expect(isCpfFrotaPlaceholder('39053344705')).toBe(false);
  });

  it('considera suspenso só enquanto a data ainda vale', () => {
    const now = new Date('2026-09-13T12:00:00.000Z');
    expect(motoristaEstaSuspenso(new Date('2026-09-20T00:00:00.000Z'), now)).toBe(true);
    expect(motoristaEstaSuspenso(new Date('2026-09-12T00:00:00.000Z'), now)).toBe(false);
    expect(motoristaEstaSuspenso(null, now)).toBe(false);
  });

  it('calcula o fim da suspensão em dias', () => {
    const now = new Date('2026-09-13T08:00:00.000-03:00');
    const ate = suspensoAteEm(7, now);
    expect(ate.getDate()).toBe(20);
  });
});
