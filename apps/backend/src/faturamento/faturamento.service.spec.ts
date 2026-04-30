import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Role, StatusSolicitacao } from '@prisma/client';
import { FaturamentoService } from './faturamento.service';

describe('FaturamentoService', () => {
  const prisma = {
    cliente: { findFirst: jest.fn() },
    solicitacao: { findMany: jest.fn() },
  };
  const auditoria = { registrar: jest.fn() };
  const nfse = { emitirNfse: jest.fn(), cancelarNfse: jest.fn() };

  const service = new FaturamentoService(prisma as never, auditoria as never, nfse as never);

  const admin = {
    role: Role.ADMIN,
    id: 'admin',
    sub: 'admin',
    email: 'a@a.com',
    permissions: [],
    clienteId: null,
  };

  const cliente = { role: Role.CLIENTE, id: 'u', sub: 'u', email: 'c@a.com', permissions: [], clienteId: null };

  it('create nega perfil cliente', async () => {
    await expect(
      service.create(
        {
          clienteId: 'c',
          periodo: '2026-04',
          itens: [{ descricao: 'Item teste', valor: 100 }],
          solicitacaoIds: [],
        },
        'u',
        cliente as never,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('create bloqueia vínculo com solicitação sem saída', async () => {
    prisma.cliente.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.solicitacao.findMany.mockResolvedValue([
      {
        id: 's1',
        protocolo: 'RL-2026-TEST',
        status: StatusSolicitacao.CONCLUIDO,
        saida: null,
      },
    ]);
    await expect(
      service.create(
        {
          clienteId: 'c1',
          periodo: '2026-04',
          itens: [{ descricao: 'Item', valor: 100 }],
          solicitacaoIds: ['s1'],
        },
        'admin',
        admin as never,
      ),
    ).rejects.toThrow(ConflictException);
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('create bloqueia vínculo com solicitação não CONCLUIDA', async () => {
    prisma.cliente.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.solicitacao.findMany.mockResolvedValue([
      {
        id: 's1',
        protocolo: 'RL-2026-TEST',
        status: StatusSolicitacao.APROVADO,
        saida: { id: 'out1' },
      },
    ]);
    await expect(
      service.create(
        {
          clienteId: 'c1',
          periodo: '2026-04',
          itens: [{ descricao: 'Item', valor: 100 }],
          solicitacaoIds: ['s1'],
        },
        'admin',
        admin as never,
      ),
    ).rejects.toThrow(ConflictException);
    expect(auditoria.registrar).toHaveBeenCalled();
  });

  it('listBoletosPortal nega sem clienteId', async () => {
    const prismaB = { boleto: { findMany: jest.fn(), count: jest.fn() } };
    const svc = new FaturamentoService(prismaB as never, auditoria as never, nfse as never);
    await expect(svc.listBoletosPortal({ page: 1, limit: 10 }, cliente as never)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
