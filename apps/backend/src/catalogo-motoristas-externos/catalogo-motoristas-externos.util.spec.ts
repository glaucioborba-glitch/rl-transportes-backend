import {
  diasRestantesSuspensao,
  isCpfFrotaPlaceholder,
  motoristaEstaSuspenso,
  normalizeMotoristaCpf,
  suspensoAteEm,
  ymdSaoPaulo,
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

  it('calcula o fim da suspensão em dias no calendário de Brasília', () => {
    const inicio = new Date('2026-09-13T08:00:00.000-03:00');
    const ate = suspensoAteEm(7, inicio);
    expect(ymdSaoPaulo(ate)).toBe('2026-09-20');
  });

  it('conta os dias restantes até o fim do bloqueio', () => {
    const now = new Date('2026-09-13T12:00:00.000-03:00');
    const ate = new Date('2026-09-20T23:59:59.999-03:00');
    expect(diasRestantesSuspensao(ate, now)).toBe(7);
  });
});
