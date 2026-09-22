import { ConflictException } from '@nestjs/common';
import {
  conflictSaldoInsuficiente,
  mensagemSaldoInsuficiente,
  montarDescricaoQuitacao,
  PIX_QUITACAO_SALDO_INSUFICIENTE,
} from './pix-quitacao-saida.util';

describe('pix-quitacao-saida.util', () => {
  const quote = {
    exigido: true,
    suficiente: false,
    saldo: 80,
    valor: 150,
    saldoApos: -70,
    ids: [
      {
        unidadeIso: 'GCXU5119401',
        unidadeProcessoId: 'up-1',
        unidadeProcessoNumero: 5,
        unidadeProcessoLabel: 'ID 5',
        valor: 150,
      },
    ],
  };

  it('explica saldo insuficiente com valores atuais', () => {
    const msg = mensagemSaldoInsuficiente(quote);
    expect(msg).toContain('Saldo insuficiente');
    expect(msg).toContain('80');
    expect(msg).toContain('150');
  });

  it('monta ConflictException com código estável', () => {
    const err = conflictSaldoInsuficiente(quote);
    expect(err).toBeInstanceOf(ConflictException);
    const body = err.getResponse() as { code: string; message: string };
    expect(body.code).toBe(PIX_QUITACAO_SALDO_INSUFICIENTE);
    expect(body.message).toContain('conta comercial');
  });

  it('descreve o débito com ID e protocolo', () => {
    expect(montarDescricaoQuitacao({ protocolo: 6, ids: quote.ids })).toContain('ID 5');
    expect(montarDescricaoQuitacao({ protocolo: 6, ids: quote.ids })).toContain('protocolo 6');
  });
});
