import { faturaImpedeCessao, inferirEtapaCessao, nfseJaEmitida } from './cessao-titularidade.util';
import { StatusPagamentoFatura, StatusUnidadeProcesso } from '@prisma/client';

describe('cessao-titularidade.util', () => {
  it('ID aberto é sempre durante a estadia', () => {
    expect(
      inferirEtapaCessao({
        statusProcesso: StatusUnidadeProcesso.ABERTO,
        fatura: { linkNfse: 'http://x', numeroRps: '1' },
      }),
    ).toBe('DURANTE_ESTADIA');
  });

  it('saída sem NFS-e é pós-saída', () => {
    expect(
      inferirEtapaCessao({
        statusProcesso: StatusUnidadeProcesso.ENCERRADO,
        fatura: { linkNfse: null, numeroRps: null },
      }),
    ).toBe('POS_SAIDA');
  });

  it('NFS-e ou RPS emitido é pós-NFS-e', () => {
    expect(
      inferirEtapaCessao({
        statusProcesso: StatusUnidadeProcesso.ENCERRADO,
        fatura: { linkNfse: 'https://nfse', numeroRps: null },
      }),
    ).toBe('POS_NFSE');
    expect(nfseJaEmitida({ numeroRps: '100' })).toBe(true);
  });

  it('fatura paga bloqueia cessão silenciosa', () => {
    expect(faturaImpedeCessao(StatusPagamentoFatura.PAGO)).toBe(true);
    expect(faturaImpedeCessao(StatusPagamentoFatura.PROCESSANDO)).toBe(false);
  });
});
