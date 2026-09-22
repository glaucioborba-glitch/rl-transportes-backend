import { StatusCadastroCliente } from '@prisma/client';
import {
  cadastroPermiteSolicitacoes,
  clienteExigeQuitacaoPix,
  FORMA_CADASTRO_INICIAL,
  formaEfetivaCadastro,
  isFormaPagamentoPix,
  PRAZO_CADASTRO_INICIAL,
  prazoEfetivoCadastro,
} from './cadastro-operacao-inicial';

describe('cadastro-operacao-inicial', () => {
  it('pendente e aprovado podem solicitar; rejeitado não', () => {
    expect(cadastroPermiteSolicitacoes(StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA)).toBe(true);
    expect(cadastroPermiteSolicitacoes(StatusCadastroCliente.APROVADO)).toBe(true);
    expect(cadastroPermiteSolicitacoes(StatusCadastroCliente.REJEITADO)).toBe(false);
    expect(cadastroPermiteSolicitacoes(null)).toBe(true);
  });

  it('pendente usa à vista / PIX mesmo com outro prazo gravado', () => {
    expect(
      prazoEfetivoCadastro(StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA, '30_DIAS'),
    ).toBe(PRAZO_CADASTRO_INICIAL);
    expect(
      prazoEfetivoCadastro(StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA, null),
    ).toBe(PRAZO_CADASTRO_INICIAL);
    expect(
      formaEfetivaCadastro(StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA, 'FATURAMENTO'),
    ).toBe(FORMA_CADASTRO_INICIAL);
    expect(
      formaEfetivaCadastro(StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA, null),
    ).toBe(FORMA_CADASTRO_INICIAL);
  });

  it('aprovado respeita o prazo cadastrado pelo financeiro', () => {
    expect(prazoEfetivoCadastro(StatusCadastroCliente.APROVADO, '30_DIAS')).toBe('30_DIAS');
    expect(formaEfetivaCadastro(StatusCadastroCliente.APROVADO, 'FATURAMENTO')).toBe('FATURAMENTO');
  });

  it('identifica forma PIX para quitação na solicitação de saída', () => {
    expect(isFormaPagamentoPix('AVISTA_PIX')).toBe(true);
    expect(isFormaPagamentoPix('PIX')).toBe(true);
    expect(isFormaPagamentoPix('FATURAMENTO')).toBe(false);
    expect(
      clienteExigeQuitacaoPix(StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA, 'FATURAMENTO'),
    ).toBe(true);
    expect(clienteExigeQuitacaoPix(StatusCadastroCliente.APROVADO, 'FATURAMENTO')).toBe(false);
    expect(clienteExigeQuitacaoPix(StatusCadastroCliente.APROVADO, 'AVISTA_PIX')).toBe(true);
  });
});
