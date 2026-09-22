import {
  chaveAgrupamentoEmbarque,
  isAlcanceEmbarque,
  isCampoEmbarque,
  normalizeValorEmbarque,
  valoresBatemAlcance,
} from './embarque-campo.util';

describe('embarque-campo.util', () => {
  it('aceita booking, processo e navio', () => {
    expect(isCampoEmbarque('booking')).toBe(true);
    expect(isCampoEmbarque('processo')).toBe(true);
    expect(isCampoEmbarque('navio')).toBe(true);
    expect(isCampoEmbarque('tipo')).toBe(false);
  });

  it('aceita os quatro alcances', () => {
    expect(isAlcanceEmbarque('unidade')).toBe(true);
    expect(isAlcanceEmbarque('processo')).toBe(true);
    expect(isAlcanceEmbarque('booking')).toBe(true);
    expect(isAlcanceEmbarque('navio')).toBe(true);
    expect(isAlcanceEmbarque('patio')).toBe(false);
  });

  it('normaliza navio em maiúsculas e colapsa espaços', () => {
    expect(normalizeValorEmbarque('navio', '  msc  loreto  ')).toBe('MSC LORETO');
  });

  it('mantém booking/processo com trim e teto 120', () => {
    expect(normalizeValorEmbarque('booking', '  BK-9  ')).toBe('BK-9');
    expect(normalizeValorEmbarque('processo', 'x'.repeat(200)).length).toBe(120);
  });

  it('permite limpar o campo', () => {
    expect(normalizeValorEmbarque('processo', '   ')).toBe('');
  });

  it('agrupa por processo/booking/navio ignorando caixa e espaços no navio', () => {
    const chave = chaveAgrupamentoEmbarque('navio', 'msc loreto');
    expect(chave).toBe('MSC LORETO');
    expect(
      valoresBatemAlcance('navio', chave, { booking: 'A', processo: 'P', navio: ' MSC  LORETO ' }),
    ).toBe(true);
    expect(valoresBatemAlcance('booking', 'BK-9', { booking: 'BK-9', processo: 'P', navio: 'X' })).toBe(
      true,
    );
    expect(valoresBatemAlcance('processo', '', { booking: '', processo: '', navio: '' })).toBe(false);
  });
});
