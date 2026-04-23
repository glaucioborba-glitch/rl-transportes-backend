import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RelatoriosService } from './relatorios.service';

describe('RelatoriosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const prisma = {
    solicitacao: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    faturamento: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    cliente: { findMany: jest.fn() },
  };

  const service = new RelatoriosService(prisma as never);

  const admin = { role: Role.ADMIN, id: '1', sub: '1', email: 'a@a.com', permissions: [] };

  it('bloqueia cliente em resumo operacional', async () => {
    await expect(
      service.resumoSolicitacoes('2026-01-01', '2026-12-31', {
        ...admin,
        role: Role.CLIENTE,
      } as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejeita datas de período inválidas', async () => {
    await expect(
      service.resumoSolicitacoes('invalid', '2026-12-31', admin as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('retorna porStatus para admin', async () => {
    prisma.solicitacao.groupBy.mockResolvedValue([
      { status: 'PENDENTE', _count: { _all: 2 } },
    ]);
    const r = await service.resumoSolicitacoes('2026-01-01', '2026-12-31', admin as never);
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.porStatus.length).toBeGreaterThan(0);
  });

  it('listaSolicitacoes retorna meta de paginação', async () => {
    prisma.solicitacao.findMany.mockResolvedValue([]);
    prisma.solicitacao.count.mockResolvedValue(0);
    const r = await service.listaSolicitacoes(
      {
        dataInicio: '2026-01-01',
        dataFim: '2026-12-31',
        page: 1,
        limit: 10,
      },
      admin as never,
    );
    expect(r.meta.total).toBe(0);
    expect(r.items).toEqual([]);
  });
});
