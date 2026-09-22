import {
  lacreRic,
  lacreTrocaPatio,
  normalizeLacreOperacional,
  textoLacreTroca,
} from './lacre-operacional.util';

describe('lacreRic', () => {
  it('RIC de entrada preserva o snapshot do gate-in', () => {
    expect(lacreRic('ENTRADA', 'CR0381735', 'LACREQA01')).toBe('CR0381735');
  });

  it('coleta/pátio usa o lacre de saída após a troca', () => {
    expect(lacreRic('SAIDA', 'CR0381735', 'LACREQA01')).toBe('LACREQA01');
  });

  it('sem troca, saída cai no lacre de entrada', () => {
    expect(lacreRic('SAIDA', 'CR0381735', null)).toBe('CR0381735');
  });

  it('normalize descarta vazio', () => {
    expect(normalizeLacreOperacional('  ')).toBeNull();
    expect(normalizeLacreOperacional(null)).toBeNull();
  });
});

describe('lacreTrocaPatio', () => {
  it('expõe anterior e atual para o operador do gate', () => {
    const troca = lacreTrocaPatio({
      lacreEntrada: 'CR0381735',
      lacreSaida: 'LACREQA01',
      observacao: 'Número do lacre alterado por RETIRADA DE EXCESSO.',
      origem: 'CLIENTE',
    });
    expect(troca).toEqual({
      atual: 'LACREQA01',
      anterior: 'CR0381735',
      observacao: 'Número do lacre alterado por RETIRADA DE EXCESSO.',
      origem: 'CLIENTE',
    });
    expect(textoLacreTroca(troca!)).toContain('Lacre atual LACREQA01');
    expect(textoLacreTroca(troca!)).toContain('entrada CR0381735');
    expect(textoLacreTroca(troca!)).toContain('RETIRADA DE EXCESSO');
    expect(textoLacreTroca(troca!)).toContain('origem cliente');
  });

  it('não gera alerta quando o número não mudou', () => {
    expect(lacreTrocaPatio({ lacreEntrada: 'ABC', lacreSaida: 'ABC' })).toBeNull();
    expect(lacreTrocaPatio({ lacreEntrada: 'ABC', lacreSaida: null })).toBeNull();
  });
});
