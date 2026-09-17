import { TipoLancamentoContaCorrente } from '@prisma/client';
import {
  classificarSaldo,
  rotuloSaldo,
  valorSinalLancamento,
} from './conta-corrente.util';

describe('conta-corrente.util', () => {
  it('crédito soma positivo e débito negativo', () => {
    expect(valorSinalLancamento(TipoLancamentoContaCorrente.CREDITO, 150.5)).toBe(150.5);
    expect(valorSinalLancamento(TipoLancamentoContaCorrente.DEBITO, 80)).toBe(-80);
  });

  it('rejeita valor zerado ou negativo', () => {
    expect(() => valorSinalLancamento(TipoLancamentoContaCorrente.CREDITO, 0)).toThrow();
    expect(() => valorSinalLancamento(TipoLancamentoContaCorrente.DEBITO, -10)).toThrow();
  });

  it('classifica saldo no sentido comercial', () => {
    expect(classificarSaldo(20)).toBe('CREDOR');
    expect(classificarSaldo(-20)).toBe('DEVEDOR');
    expect(classificarSaldo(0)).toBe('ZERADO');
    expect(rotuloSaldo(-50)).toBe('Em aberto — pagar depois');
  });
});
