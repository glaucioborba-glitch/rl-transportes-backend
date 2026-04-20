import { AcaoAuditoria } from '@prisma/client';
import { AuditoriaService } from './auditoria.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditoriaService', () => {
  let service: AuditoriaService;
  const create = jest.fn().mockResolvedValue({ id: 'a1' });
  const findMany = jest.fn().mockResolvedValue([]);

  const count = jest.fn().mockResolvedValue(0);

  const prisma = {
    auditoria: { create, findMany, count },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditoriaService(prisma as unknown as PrismaService);
  });

  describe('registrar', () => {
    it('registra ação INSERT', async () => {
      await service.registrar({
        tabela: 'clientes',
        registroId: 'r1',
        acao: AcaoAuditoria.INSERT,
        usuario: 'u1',
        dadosDepois: { x: 1 },
      });
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tabela: 'clientes',
            registroId: 'r1',
            acao: AcaoAuditoria.INSERT,
            usuario: 'u1',
          }),
        }),
      );
    });

    it('registra ação UPDATE com dados antes/depois', async () => {
      await service.registrar({
        tabela: 'clientes',
        registroId: 'r1',
        acao: AcaoAuditoria.UPDATE,
        usuario: 'u1',
        dadosAntes: { a: 0 },
        dadosDepois: { a: 1 },
      });
      expect(create).toHaveBeenCalled();
    });

    it('registra ação DELETE', async () => {
      await service.registrar({
        tabela: 'clientes',
        registroId: 'r1',
        acao: AcaoAuditoria.DELETE,
        usuario: 'u1',
        dadosAntes: { id: 'r1' },
      });
      expect(create).toHaveBeenCalled();
    });
  });

  describe('buscarPorRegistro', () => {
    it('retorna histórico de um registro', async () => {
      findMany.mockResolvedValueOnce([{ id: '1' }]);
      const r = await service.buscarPorRegistro('clientes', 'r1');
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tabela: 'clientes', registroId: 'r1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(r).toEqual([{ id: '1' }]);
    });
  });

  describe('buscarPorUsuario', () => {
    it('retorna ações de um usuário', async () => {
      findMany.mockResolvedValueOnce([{ id: '1' }]);
      const r = await service.buscarPorUsuario('u1', 50);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { usuario: 'u1' },
          take: 50,
        }),
      );
      expect(r).toEqual([{ id: '1' }]);
    });
  });

  describe('buscarComFiltros', () => {
    it('pagina e filtra por tabela', async () => {
      findMany.mockResolvedValueOnce([]);
      count.mockResolvedValueOnce(0);
      await service.buscarComFiltros({ page: 2, limit: 10, tabela: 'clientes' });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tabela: 'clientes' },
          skip: 10,
          take: 10,
        }),
      );
      expect(count).toHaveBeenCalledWith({ where: { tabela: 'clientes' } });
    });
  });

  describe('buscarPorPeriodo', () => {
    it('filtra por intervalo de datas', async () => {
      const i = new Date('2026-01-01');
      const f = new Date('2026-12-31');
      await service.buscarPorPeriodo(i, f);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: { gte: i, lte: f },
          },
        }),
      );
    });
  });
});
