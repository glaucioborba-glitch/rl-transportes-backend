import {
  addWeeksYmd,
  isEspanholSabadoTrabalho,
  nearestSaturdayOnOrAfter,
  proximoParEspanhol,
} from './espanhol-sabado.util';

describe('espanhol-sabado.util', () => {
  it('ancora no sábado e alterna trabalho/folga a cada semana', () => {
    expect(nearestSaturdayOnOrAfter('2026-09-29')).toBe('2026-10-03');
    expect(isEspanholSabadoTrabalho('2026-10-03', '2026-10-03')).toBe(true);
    expect(isEspanholSabadoTrabalho('2026-10-03', '2026-10-10')).toBe(false);
    expect(isEspanholSabadoTrabalho('2026-10-03', '2026-10-17')).toBe(true);
    expect(addWeeksYmd('2026-10-03', 1)).toBe('2026-10-10');
  });

  it('próximo par a partir de uma terça', () => {
    const par = proximoParEspanhol('2026-10-03', '2026-09-29');
    expect(par.trabalha).toBe('2026-10-03');
    expect(par.folga).toBe('2026-10-10');
  });
});
