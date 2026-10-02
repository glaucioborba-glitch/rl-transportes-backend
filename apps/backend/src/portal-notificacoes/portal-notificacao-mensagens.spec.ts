import { TipoNotificacaoPortal } from '@prisma/client';
import {
  mensagemCadastroAprovado,
  mensagemCadastroEmAnalise,
  mensagemCadastroRejeitado,
  mensagemCondicaoAlterada,
  mensagemPixCreditoAprovado,
  mensagemPixCreditoNegado,
  mensagemUnidadeProcessoAberto,
  mensagemUnidadeProcessoEncerrado,
} from './portal-notificacao-mensagens';

describe('portal-notificacao-mensagens', () => {
  it('cadastro em análise menciona 48 horas, à vista e PIX', () => {
    const m = mensagemCadastroEmAnalise();
    expect(m.tipo).toBe(TipoNotificacaoPortal.CADASTRO_EM_ANALISE);
    expect(m.corpo).toMatch(/48 horas/i);
    expect(m.corpo).toMatch(/à vista/i);
    expect(m.corpo).toMatch(/PIX/i);
  });

  it('aprovação informa forma e prazo', () => {
    const m = mensagemCadastroAprovado('FATURAMENTO', '30_DIAS');
    expect(m.tipo).toBe(TipoNotificacaoPortal.CADASTRO_APROVADO);
    expect(m.corpo).toMatch(/faturamento/i);
    expect(m.corpo).toMatch(/30 dias/i);
  });

  it('rejeição inclui o motivo', () => {
    const m = mensagemCadastroRejeitado('Documentação incompleta');
    expect(m.tipo).toBe(TipoNotificacaoPortal.CADASTRO_REJEITADO);
    expect(m.corpo).toContain('Documentação incompleta');
  });

  it('alteração de condição descreve a nova vigência', () => {
    const m = mensagemCondicaoAlterada('AVISTA_PIX', 'A_VISTA');
    expect(m.tipo).toBe(TipoNotificacaoPortal.CONDICAO_PAGAMENTO_ALTERADA);
    expect(m.corpo).toMatch(/PIX à vista/i);
    expect(m.corpo).toMatch(/à vista/i);
  });

  it('notifica abertura e encerramento do ID', () => {
    const aberto = mensagemUnidadeProcessoAberto(1284, 'MSKU1234567');
    expect(aberto.tipo).toBe(TipoNotificacaoPortal.UNIDADE_PROCESSO_ABERTO);
    expect(aberto.titulo).toContain('1284');
    const saida = mensagemUnidadeProcessoEncerrado(1284, 'MSKU1234567');
    expect(saida.tipo).toBe(TipoNotificacaoPortal.UNIDADE_PROCESSO_ENCERRADO);
    expect(saida.corpo).toMatch(/consolidada/i);
  });

  it('notifica aprovação e negativa do comprovante PIX', () => {
    const ok = mensagemPixCreditoAprovado(150);
    expect(ok.tipo).toBe(TipoNotificacaoPortal.PIX_CREDITO_APROVADO);
    expect(ok.corpo).toMatch(/R\$ 150,00/);
    const neg = mensagemPixCreditoNegado(80, 'Valor divergente da conta');
    expect(neg.tipo).toBe(TipoNotificacaoPortal.PIX_CREDITO_NEGADO);
    expect(neg.corpo).toContain('Valor divergente da conta');
  });
});
