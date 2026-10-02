import { chaveAcessoValida, montarDpsId } from './dps-id.util';

describe('montarDpsId', () => {
  it('monta o Id com 45 caracteres no layout oficial', () => {
    const id = montarDpsId({
      municipioIbge: '4211306',
      documentoPrestador: '27.692.077/0001-26',
      serie: '1',
      numero: 42,
    });
    expect(id).toBe('DPS4211306227692077000126' + '00001' + '000000000000042');
    expect(id).toHaveLength(45);
  });

  it('usa tipo de inscrição 1 e zeros à esquerda para CPF', () => {
    const id = montarDpsId({
      municipioIbge: '4211306',
      documentoPrestador: '123.456.789-09',
      serie: '900',
      numero: '7',
    });
    expect(id.slice(3, 10)).toBe('4211306');
    expect(id.slice(10, 11)).toBe('1');
    expect(id.slice(11, 25)).toBe('00012345678909');
    expect(id.slice(25, 30)).toBe('00900');
  });

  it('recusa documento de prestador inválido', () => {
    expect(() =>
      montarDpsId({ municipioIbge: '4211306', documentoPrestador: '123', serie: '1', numero: 1 }),
    ).toThrow(/inv[áa]lido/i);
  });
});

describe('chaveAcessoValida', () => {
  it('exige 50 dígitos', () => {
    expect(chaveAcessoValida('1'.repeat(50))).toBe(true);
    expect(chaveAcessoValida('1'.repeat(49))).toBe(false);
    expect(chaveAcessoValida(undefined)).toBe(false);
  });
});
