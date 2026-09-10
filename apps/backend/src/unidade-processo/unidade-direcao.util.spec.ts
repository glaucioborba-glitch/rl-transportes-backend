import { StatusContainer, TipoOperacaoSolicitacaoIntent } from '@prisma/client';
import {
  assertCargaCompativelComIntent,
  direcaoUnidade,
  formatUnidadeProcessoId,
  isDirecaoEntrada,
  isDirecaoSaida,
  rotuloDirecaoUnidade,
} from './unidade-direcao.util';

describe('unidade-direcao.util', () => {
  it('baixa e importação/coleta depot são ENTRADA', () => {
    expect(direcaoUnidade(TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA)).toBe('ENTRADA');
    expect(direcaoUnidade(TipoOperacaoSolicitacaoIntent.SOLICITAR_IMPORTACAO_COLETA_DEPOT)).toBe(
      'ENTRADA',
    );
    expect(isDirecaoEntrada(TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA)).toBe(true);
  });

  it('coleta e exportação/entrega depot são SAIDA', () => {
    expect(direcaoUnidade(TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA)).toBe('SAIDA');
    expect(direcaoUnidade(TipoOperacaoSolicitacaoIntent.SOLICITAR_EXPORTACAO_ENTREGA_DEPOT)).toBe(
      'SAIDA',
    );
    expect(isDirecaoSaida(TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA)).toBe(true);
  });

  it('transferência/inspeção/reparo são INTERNA', () => {
    expect(direcaoUnidade(TipoOperacaoSolicitacaoIntent.SOLICITAR_TRANSFERENCIA)).toBe('INTERNA');
    expect(direcaoUnidade(null)).toBe('INTERNA');
  });

  it('formata o ID sequencial para consulta visual', () => {
    expect(formatUnidadeProcessoId(1284)).toBe('ID 1284');
    expect(rotuloDirecaoUnidade('ENTRADA')).toBe('Entrada');
    expect(rotuloDirecaoUnidade('SAIDA')).toBe('Saída');
  });

  it('CHEIO/VAZIO são válidos; situação vazia falha', () => {
    expect(() =>
      assertCargaCompativelComIntent(TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA, StatusContainer.CHEIO),
    ).not.toThrow();
    expect(() =>
      assertCargaCompativelComIntent(TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA, StatusContainer.VAZIO),
    ).not.toThrow();
    expect(() =>
      assertCargaCompativelComIntent(TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA, ''),
    ).toThrow(/inválida/);
  });
});
