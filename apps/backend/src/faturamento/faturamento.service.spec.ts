import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { FaturamentoService } from './faturamento.service';

describe('FaturamentoService', () => {
  const prisma = {
    cliente: { findFirst: jest.fn() },
    solicitacao: { findMany: jest.fn() },
  };
  const auditoria = { registrar: jest.fn() };
  const nfse = { emitirNfse: jest.fn(), cancelarNfse: jest.fn() };

  const service = new FaturamentoService(prisma as never, auditoria as never, nfse as never);

  const cliente = { role: Role.CLIENTE, id: 'u', sub: 'u', email: 'c@a.com', permissions: [], clienteId: null };

  it('create nega perfil cliente', async () => {
    await expect(
      service.create(
        { clienteId: 'c', periodo: '2026-04', valorTotal: 100, solicitacaoIds: [] },
        'u',
        cliente as never,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('listBoletosPortal nega sem clienteId', async () => {
    const prismaB = { boleto: { findMany: jest.fn(), count: jest.fn() } };
    const svc = new FaturamentoService(prismaB as never, auditoria as never, nfse as never);
    await expect(svc.listBoletosPortal({ page: 1, limit: 10 }, cliente as never)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
