import { ricFormatDateTime } from './ric-pdf-estilo-cupom';

describe('ricFormatDateTime', () => {
  it('mostra horário de Brasília, não UTC', () => {
    const out = ricFormatDateTime('2026-09-30T12:01:52.000Z');
    expect(out).toContain('09:01:52');
    expect(out).not.toContain('12:01:52');
  });
});
