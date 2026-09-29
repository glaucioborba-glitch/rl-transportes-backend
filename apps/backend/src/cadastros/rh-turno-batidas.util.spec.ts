import { assertBatidasJornada, hhmmToMinutes } from './rh-turno-batidas.util';

describe('rh-turno-batidas.util', () => {
  it('aceita jornada com almoço entre início e saída', () => {
    expect(() => assertBatidasJornada('07:00', '11:00', '12:00', '16:00', 'Dias úteis')).not.toThrow();
  });

  it('aceita jornada contínua sem intervalo', () => {
    expect(() => assertBatidasJornada('08:00', '', '', '12:00', 'Meio período')).not.toThrow();
  });

  it('rejeita intervalo fora da ordem', () => {
    expect(() => assertBatidasJornada('07:00', '16:00', '17:00', '16:00', 'Sábado')).toThrow(/ordem/);
  });

  it('converte HH:MM', () => {
    expect(hhmmToMinutes('12:30')).toBe(12 * 60 + 30);
  });
});
