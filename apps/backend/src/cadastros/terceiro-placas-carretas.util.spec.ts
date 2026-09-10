import { CapacidadeVeiculoTerceiro } from '@prisma/client';
import {
  normalizeCarretasTerceiro,
  normalizePlacasCarretas,
  parseIndiceDocumento,
  resumoCapacidadeCarretas,
} from './terceiro-placas-carretas.util';

describe('normalizePlacasCarretas', () => {
  it('normaliza, tira vazio e duplicata', () => {
    expect(normalizePlacasCarretas(['abc1d23', '', 'ABC-1D23', 'XYZ9E87'])).toEqual(['ABC1D23', 'XYZ9E87']);
  });

  it('usa fallback quando a lista não vem', () => {
    expect(normalizePlacasCarretas(undefined, ['AAA1B23', null, 'BBB2C34'])).toEqual(['AAA1B23', 'BBB2C34']);
  });
});

describe('normalizeCarretasTerceiro', () => {
  it('mantém pinagem, Renavam e validade por carreta', () => {
    expect(
      normalizeCarretasTerceiro([
        { placa: 'abc1d23', capacidade: 'PE_40', renavam: '12345678901', validadeDocumento: '2027-03-10' },
        { placa: '', capacidade: 'PE_20' },
      ]),
    ).toEqual([
      {
        placa: 'ABC1D23',
        capacidade: CapacidadeVeiculoTerceiro.PE_40,
        pinos: ['40'],
        renavam: '12345678901',
        validadeDocumento: '2027-03-10',
      },
    ]);
  });
});

describe('resumoCapacidadeCarretas', () => {
  it('usa AMBOS quando as pinagens diferem', () => {
    const rows = normalizeCarretasTerceiro([
      { placa: 'AAA1B23', capacidade: 'PE_20' },
      { placa: 'BBB2C34', capacidade: 'PE_40' },
    ]);
    expect(resumoCapacidadeCarretas(rows)).toBe(CapacidadeVeiculoTerceiro.AMBOS);
  });
});

describe('parseIndiceDocumento', () => {
  it('aceita índice válido e rejeita fora da faixa', () => {
    expect(parseIndiceDocumento('0')).toBe(0);
    expect(parseIndiceDocumento(2)).toBe(2);
    expect(parseIndiceDocumento('99')).toBeNull();
    expect(parseIndiceDocumento('')).toBeNull();
  });
});
