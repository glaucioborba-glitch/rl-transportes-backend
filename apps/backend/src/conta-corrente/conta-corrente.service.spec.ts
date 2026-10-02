import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MotivoLancamentoContaCorrente, StatusPixCreditoComprovante, TipoLancamentoContaCorrente } from '@prisma/client';
import { ContaCorrenteService } from './conta-corrente.service';
import { DecisaoPixCreditoComprovante } from './dto/decidir-pix-credito-comprovante.dto';

const cliente = {
  id: 'cli-1',
  razaoSocial: 'Costa Sul',
  nomeFantasia: 'Costa',
  cpfCnpj: '12345678000100',
  tenantId: 'default',
  deletedAt: null,
};

function user() {
  return {
    id: 'u1',
    sub: 'u1',
    email: 'admin@rl.test',
    cpfCnpj: '39053344705',
    role: 'ADMIN' as const,
    permissions: [],
  };
}

describe('ContaCorrenteService', () => {
  const prisma = {
    cliente: { findMany: jest.fn(), findFirst: jest.fn() },
    clienteContaCorrenteLancamento: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    clientePixCreditoComprovante: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const auditoria = { registrar: jest.fn() };
  const storage = { getBuffer: jest.fn(), upload: jest.fn() };
  const notificacoes = { criarPixCreditoAprovado: jest.fn(), criarPixCreditoNegado: jest.fn() };
  const service = new ContaCorrenteService(
    prisma as never,
    auditoria as never,
    storage as never,
    notificacoes as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.clientePixCreditoComprovante.groupBy.mockResolvedValue([]);
    prisma.clientePixCreditoComprovante.findMany.mockResolvedValue([]);
    prisma.clientePixCreditoComprovante.count.mockResolvedValue(0);
  });

  it('lista saldo agregado', async () => {
    prisma.cliente.findMany.mockResolvedValue([cliente]);
    prisma.clienteContaCorrenteLancamento.groupBy.mockResolvedValue([
      { clienteId: 'cli-1', _sum: { valorSinal: -80 }, _count: { _all: 1 } },
    ]);
    const out = await service.listar({});
    expect(out.items[0].saldo).toBe(-80);
    expect(out.items[0].situacao).toBe('DEVEDOR');
    expect(out.items[0].comprovantesPendentes).toBe(0);
  });

  it('coloca clientes com comprovante pendente no topo da lista', async () => {
    prisma.cliente.findMany.mockResolvedValue([
      { ...cliente, id: 'cli-a', razaoSocial: 'Alpha' },
      { ...cliente, id: 'cli-b', razaoSocial: 'Beta' },
    ]);
    prisma.clienteContaCorrenteLancamento.groupBy.mockResolvedValue([
      { clienteId: 'cli-a', _sum: { valorSinal: 900 }, _count: { _all: 1 } },
    ]);
    prisma.clientePixCreditoComprovante.groupBy.mockResolvedValue([
      { clienteId: 'cli-b', _count: { _all: 2 } },
    ]);
    const out = await service.listar({});
    expect(out.items.map((i) => i.id)).toEqual(['cli-b', 'cli-a']);
    expect(out.items[0].comprovantesPendentes).toBe(2);
  });

  it('não lança em cliente inexistente', async () => {
    prisma.cliente.findFirst.mockResolvedValue(null);
    await expect(
      service.lancar(
        'x',
        {
          tipo: TipoLancamentoContaCorrente.CREDITO,
          valor: 10,
          descricao: 'Acordo da operação',
        },
        user(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('recusa compensação pelo formulário de lançamento', async () => {
    await expect(
      service.lancar(
        'cli-1',
        {
          tipo: TipoLancamentoContaCorrente.CREDITO,
          valor: 10,
          motivo: MotivoLancamentoContaCorrente.COMPENSACAO,
          descricao: 'não pode',
        },
        user(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa débito que deixaria a conta comercial negativa', async () => {
    prisma.clienteContaCorrenteLancamento.aggregate.mockResolvedValue({
      _sum: { valorSinal: 50 },
    });
    await expect(
      service.debitarNaTransacao(prisma as never, {
        tenantId: 'default',
        clienteId: 'cli-1',
        valor: 80,
        descricao: 'Quitação PIX do ID 5',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.clienteContaCorrenteLancamento.create).not.toHaveBeenCalled();
  });

  it('debita na transação quando há saldo', async () => {
    prisma.clienteContaCorrenteLancamento.aggregate.mockResolvedValue({
      _sum: { valorSinal: 200 },
    });
    prisma.clienteContaCorrenteLancamento.create.mockResolvedValue({ id: 'l1' });
    const out = await service.debitarNaTransacao(prisma as never, {
      tenantId: 'default',
      clienteId: 'cli-1',
      valor: 80,
      descricao: 'Quitação PIX do ID 5',
      createdByUserId: 'u1',
      createdByNome: 'portal',
    });
    expect(out.saldoAntes).toBe(200);
    expect(out.saldoDepois).toBe(120);
    expect(prisma.clienteContaCorrenteLancamento.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tipo: TipoLancamentoContaCorrente.DEBITO,
          motivo: MotivoLancamentoContaCorrente.QUITACAO_ID,
        }),
      }),
    );
  });

  it('aprova comprovante, notifica o cliente e não lança crédito', async () => {
    prisma.cliente.findFirst.mockResolvedValue(cliente);
    prisma.clientePixCreditoComprovante.findFirst.mockResolvedValue({
      id: 'comp-1',
      clienteId: 'cli-1',
      status: StatusPixCreditoComprovante.PENDENTE,
      valor: 150,
    });
    prisma.clienteContaCorrenteLancamento.findMany.mockResolvedValue([]);
    prisma.clientePixCreditoComprovante.findMany.mockResolvedValue([]);
    await service.conferirComprovante(
      'cli-1',
      'comp-1',
      { decisao: DecisaoPixCreditoComprovante.APROVADO },
      user(),
    );
    expect(prisma.clientePixCreditoComprovante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comp-1' },
        data: expect.objectContaining({ status: StatusPixCreditoComprovante.APROVADO }),
      }),
    );
    expect(notificacoes.criarPixCreditoAprovado).toHaveBeenCalled();
    expect(prisma.clienteContaCorrenteLancamento.create).not.toHaveBeenCalled();
  });

  it('nega comprovante com inconsistência e notifica o cliente', async () => {
    prisma.cliente.findFirst.mockResolvedValue(cliente);
    prisma.clientePixCreditoComprovante.findFirst.mockResolvedValue({
      id: 'comp-1',
      clienteId: 'cli-1',
      status: StatusPixCreditoComprovante.PENDENTE,
      valor: 80,
    });
    prisma.clienteContaCorrenteLancamento.findMany.mockResolvedValue([]);
    prisma.clientePixCreditoComprovante.findMany.mockResolvedValue([]);
    await service.conferirComprovante(
      'cli-1',
      'comp-1',
      { decisao: DecisaoPixCreditoComprovante.NEGADO, observacao: 'Valor divergente' },
      user(),
    );
    expect(prisma.clientePixCreditoComprovante.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusPixCreditoComprovante.NEGADO,
          decisaoObservacao: 'Valor divergente',
        }),
      }),
    );
    expect(notificacoes.criarPixCreditoNegado).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: 'Valor divergente' }),
    );
  });

  it('recusa negar sem descrever a inconsistência', async () => {
    prisma.cliente.findFirst.mockResolvedValue(cliente);
    prisma.clientePixCreditoComprovante.findFirst.mockResolvedValue({
      id: 'comp-1',
      clienteId: 'cli-1',
      status: StatusPixCreditoComprovante.PENDENTE,
      valor: 150,
    });
    await expect(
      service.conferirComprovante(
        'cli-1',
        'comp-1',
        { decisao: DecisaoPixCreditoComprovante.NEGADO },
        user(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.clientePixCreditoComprovante.update).not.toHaveBeenCalled();
  });
});
