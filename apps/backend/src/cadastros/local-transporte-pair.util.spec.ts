import { BadRequestException } from '@nestjs/common';
import { pairLocaisTransporte, rotuloTrecho, valorCobradoTransporte, valorPagoTerceiroEfetivo } from './local-transporte-pair.util';

describe('pairLocaisTransporte', () => {
  it('ordena ids para que o sentido não gere outro trecho', () => {
    expect(pairLocaisTransporte('portonave', 'fl')).toEqual({
      localAId: 'fl',
      localBId: 'portonave',
    });
    expect(pairLocaisTransporte('fl', 'portonave')).toEqual({
      localAId: 'fl',
      localBId: 'portonave',
    });
  });

  it('rejeita origem igual ao destino', () => {
    expect(() => pairLocaisTransporte('fl', 'fl')).toThrow(BadRequestException);
  });
});

describe('rotuloTrecho', () => {
  it('exibe nomes em ordem alfabética', () => {
    expect(rotuloTrecho('Portonave', 'FL')).toBe('FL × Portonave');
    expect(rotuloTrecho('FL', 'Portonave')).toBe('FL × Portonave');
  });
});

describe('valorCobradoTransporte', () => {
  it('mantém a tarifa na ida e aplica 50% no retorno', () => {
    expect(valorCobradoTransporte(540, false)).toBe(540);
    expect(valorCobradoTransporte(540, true)).toBe(270);
  });
});

describe('valorPagoTerceiroEfetivo', () => {
  it('aplica 50% no retorno e preserva ausência de valor', () => {
    expect(valorPagoTerceiroEfetivo(300, false)).toBe(300);
    expect(valorPagoTerceiroEfetivo(300, true)).toBe(150);
    expect(valorPagoTerceiroEfetivo(null, true)).toBeNull();
  });
});
