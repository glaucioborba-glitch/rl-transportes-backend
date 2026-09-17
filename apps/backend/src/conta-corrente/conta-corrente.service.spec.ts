import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MotivoLancamentoContaCorrente, TipoLancamentoContaCorrente } from '@prisma/client';
import { ContaCorrenteService } from './conta-corrente.service';

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
    },
  };
  const auditoria = { registrar: jest.fn() };
  const service = new ContaCorrenteService(prisma as never, auditoria as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lista saldo agregado', async () => {
    prisma.cliente.findMany.mockResolvedValue([cliente]);
    prisma.clienteContaCorrenteLancamento.groupBy.mockResolvedValue([
      { clienteId: 'cli-1', _sum: { valorSinal: -80 }, _count: { _all: 1 } },
    ]);
    const out = await service.listar({});
    expect(out.items[0].saldo).toBe(-80);
    expect(out.items[0].situacao).toBe('DEVEDOR');
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
});
