import {
  classificarAcaoAuditoria,
  payloadExigeSenha,
} from './classificacao-auditoria.util';

describe('classificacao-auditoria.util', () => {
  it('marca inclusões e gate como verdes', () => {
    expect(classificarAcaoAuditoria({ acao: 'INSERT', tabela: 'auth' })).toBe('VERDE');
    expect(classificarAcaoAuditoria({ acao: 'INSERT', categoria: 'SEGURANCA' })).toBe('VERDE');
    expect(classificarAcaoAuditoria({ acao: 'GATE_IN_REALIZADO' })).toBe('VERDE');
    expect(classificarAcaoAuditoria({ acao: 'GATE_OUT_REALIZADO' })).toBe('VERDE');
  });

  it('marca edição de dado já gravado como amarela', () => {
    expect(classificarAcaoAuditoria({ acao: 'SOLICITACAO_ALTERADA' })).toBe('AMARELO');
    expect(classificarAcaoAuditoria({ acao: 'CADASTRO_ALTERADO' })).toBe('AMARELO');
    expect(classificarAcaoAuditoria({ acao: 'UNIDADE_ALTERADA' })).toBe('AMARELO');
    expect(classificarAcaoAuditoria({ acao: 'UPDATE' })).toBe('AMARELO');
  });

  it('marca faturamento, exclusão e senha de gerente como vermelhas', () => {
    expect(classificarAcaoAuditoria({ acao: 'FATURA_ALTERADA' })).toBe('VERMELHO');
    expect(classificarAcaoAuditoria({ acao: 'SEGURANCA' })).toBe('VERMELHO');
    expect(classificarAcaoAuditoria({ acao: 'INSERT', tabela: 'faturamentos' })).toBe('VERMELHO');
    expect(
      classificarAcaoAuditoria({
        acao: 'INSERT',
        tabela: 'cliente_conta_corrente_lancamentos',
      }),
    ).toBe('VERMELHO');
    expect(
      classificarAcaoAuditoria({
        acao: 'UPDATE',
        dadosNovos: { gerenteToken: 'x', gerenteId: 'g1' },
      }),
    ).toBe('VERMELHO');
    expect(payloadExigeSenha({ supervisor: { email: 'a@b.com' } })).toBe(true);
  });
});
