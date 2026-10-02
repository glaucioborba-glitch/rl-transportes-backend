import { ConflictException } from '@nestjs/common';
import { StatusCadastroCliente, TipoOperacaoSolicitacaoIntent } from '@prisma/client';
import { PixQuitacaoSaidaService } from './pix-quitacao-saida.service';

describe('PixQuitacaoSaidaService', () => {
  const prisma = {
    cliente: { findFirst: jest.fn() },
    unidadeProcesso: { findFirst: jest.fn() },
    preFatura: { findFirst: jest.fn() },
  };
  const billing = { recalcularDiariasAte: jest.fn().mockResolvedValue(undefined) };
  const contaCorrente = {
    saldoCliente: jest.fn(),
    debitarNaTransacao: jest.fn(),
  };
  const service = new PixQuitacaoSaidaService(prisma as never, billing as never, contaCorrente as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('não exige quitação em baixa (entrada)', async () => {
    const out = await service.cotar({
      clienteId: 'cli-1',
      intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_BAIXA,
      unidades: ['CSQU3054383'],
    });
    expect(out.exigido).toBe(false);
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
  });

  it('não exige quitação quando o cliente é faturamento', async () => {
    prisma.cliente.findFirst.mockResolvedValue({
      id: 'cli-1',
      tenantId: 'default',
      statusCadastro: StatusCadastroCliente.APROVADO,
      condicaoPagamento: 'FATURAMENTO',
    });
    const out = await service.cotar({
      clienteId: 'cli-1',
      intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
      unidades: ['CSQU3054383'],
    });
    expect(out.exigido).toBe(false);
  });

  it('cota o valor do ID e recusa saldo insuficiente', async () => {
    prisma.cliente.findFirst.mockResolvedValue({
      id: 'cli-1',
      tenantId: 'default',
      statusCadastro: StatusCadastroCliente.APROVADO,
      condicaoPagamento: 'AVISTA_PIX',
    });
    prisma.unidadeProcesso.findFirst.mockResolvedValue({
      id: 'up-1',
      numero: 5,
      unidadeIso: 'CSQU3054383',
    });
    prisma.preFatura.findFirst.mockResolvedValue({ valorAcumulado: 150 });
    contaCorrente.saldoCliente.mockResolvedValue(80);

    const out = await service.cotar({
      clienteId: 'cli-1',
      intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
      unidades: ['CSQU3054383'],
      dataRef: '2026-10-05',
    });
    expect(out.exigido).toBe(true);
    expect(out.suficiente).toBe(false);
    expect(out.valor).toBe(150);
    expect(out.saldo).toBe(80);
    expect(billing.recalcularDiariasAte).toHaveBeenCalledWith(
      'up-1',
      new Date('2026-10-05T12:00:00.000Z'),
      prisma,
    );
  });

  it('debita na transação quando o saldo cobre o ID', async () => {
    prisma.cliente.findFirst.mockResolvedValue({
      id: 'cli-1',
      tenantId: 'default',
      statusCadastro: StatusCadastroCliente.PENDENTE_ANALISE_FINANCEIRA,
      condicaoPagamento: 'FATURAMENTO',
    });
    prisma.unidadeProcesso.findFirst.mockResolvedValue({
      id: 'up-1',
      numero: 5,
      unidadeIso: 'CSQU3054383',
    });
    prisma.preFatura.findFirst.mockResolvedValue({ valorAcumulado: 100 });
    contaCorrente.saldoCliente.mockResolvedValue(250);
    contaCorrente.debitarNaTransacao.mockResolvedValue({ saldoAntes: 250, saldoDepois: 150 });

    const tx = prisma;
    const out = await service.debitarNaTransacao(tx as never, {
      clienteId: 'cli-1',
      tenantId: 'default',
      intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
      unidades: ['CSQU3054383'],
      protocolo: 6,
      solicitacaoId: 'sol-1',
      actorId: 'user-1',
      actorNome: 'portal@cliente.test',
    });
    expect(out.exigido).toBe(true);
    expect(contaCorrente.debitarNaTransacao).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ valor: 100, clienteId: 'cli-1' }),
    );
  });

  it('não debita quando o valor do ID é zero', async () => {
    prisma.cliente.findFirst.mockResolvedValue({
      id: 'cli-1',
      tenantId: 'default',
      statusCadastro: StatusCadastroCliente.APROVADO,
      condicaoPagamento: 'AVISTA_PIX',
    });
    prisma.unidadeProcesso.findFirst.mockResolvedValue({
      id: 'up-1',
      numero: 5,
      unidadeIso: 'CSQU3054383',
    });
    prisma.preFatura.findFirst.mockResolvedValue({ valorAcumulado: 0 });
    contaCorrente.saldoCliente.mockResolvedValue(10);

    await service.debitarNaTransacao(prisma as never, {
      clienteId: 'cli-1',
      tenantId: 'default',
      intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
      unidades: ['CSQU3054383'],
      protocolo: 6,
      solicitacaoId: 'sol-1',
      actorId: 'user-1',
      actorNome: 'portal',
    });
    expect(contaCorrente.debitarNaTransacao).not.toHaveBeenCalled();
  });

  it('lança conflito se o saldo cair entre a cotação e o débito', async () => {
    prisma.cliente.findFirst.mockResolvedValue({
      id: 'cli-1',
      tenantId: 'default',
      statusCadastro: StatusCadastroCliente.APROVADO,
      condicaoPagamento: 'AVISTA_PIX',
    });
    prisma.unidadeProcesso.findFirst.mockResolvedValue({
      id: 'up-1',
      numero: 5,
      unidadeIso: 'CSQU3054383',
    });
    prisma.preFatura.findFirst.mockResolvedValue({ valorAcumulado: 100 });
    contaCorrente.saldoCliente.mockResolvedValue(40);

    await expect(
      service.debitarNaTransacao(prisma as never, {
        clienteId: 'cli-1',
        tenantId: 'default',
        intent: TipoOperacaoSolicitacaoIntent.SOLICITAR_COLETA,
        unidades: ['CSQU3054383'],
        protocolo: 6,
        solicitacaoId: 'sol-1',
        actorId: 'user-1',
        actorNome: 'portal',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(contaCorrente.debitarNaTransacao).not.toHaveBeenCalled();
  });
});
