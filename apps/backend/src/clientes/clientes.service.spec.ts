import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AcaoAuditoria, Prisma, TipoCliente } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ClientesService', () => {
  let service: ClientesService;

  const auditoria = { registrar: jest.fn().mockResolvedValue({}) };
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const prisma = {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(tx)),
    cliente: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  const tx = {
    cliente: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditoria: { create: jest.fn() },
  };

  beforeEach(async () => {
    prisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get(ClientesService);
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
  });

  const clienteRow = (over: Partial<Record<string, unknown>> = {}) => ({
    id: 'c1',
    nome: 'X',
    tipo: TipoCliente.PF,
    cpfCnpj: '11144477735',
    email: 'x@x.com',
    telefone: '11999999999',
    endereco: 'Rua',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...over,
  });

  describe('create', () => {
    it('deve criar cliente PF válido', async () => {
      tx.cliente.findFirst.mockResolvedValue(null);
      tx.cliente.create.mockResolvedValue(clienteRow());

      await service.create(
        {
          nome: 'X',
          tipo: TipoCliente.PF,
          cpfCnpj: '11144477735',
          email: 'x@x.com',
          telefone: '11999999999',
          endereco: 'Rua',
        },
        'user-1',
      );

      expect(tx.cliente.create).toHaveBeenCalled();
      expect(auditoria.registrar).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          tabela: 'clientes',
          acao: AcaoAuditoria.INSERT,
          userId: 'user-1',
        }),
      );
    });

    it('deve criar cliente PJ válido', async () => {
      tx.cliente.findFirst.mockResolvedValue(null);
      tx.cliente.create.mockResolvedValue(clienteRow({ tipo: TipoCliente.PJ, cpfCnpj: '12345678000195' }));

      await service.create(
        {
          nome: 'Empresa',
          tipo: TipoCliente.PJ,
          cpfCnpj: '12345678000195',
          email: 'pj@x.com',
          telefone: '11999999999',
          endereco: 'Rua',
        },
        'user-1',
      );

      expect(tx.cliente.create).toHaveBeenCalled();
    });

    it('deve registrar auditoria em INSERT', async () => {
      tx.cliente.findFirst.mockResolvedValue(null);
      tx.cliente.create.mockResolvedValue(clienteRow());
      await service.create(
        {
          nome: 'X',
          tipo: TipoCliente.PF,
          cpfCnpj: '11144477735',
          email: 'x@x.com',
          telefone: '11999999999',
          endereco: 'Rua',
        },
        'u',
      );
      expect(auditoria.registrar).toHaveBeenCalled();
    });

    it('deve rejeitar cpfCnpj duplicado', async () => {
      tx.cliente.findFirst.mockResolvedValue(clienteRow());
      await expect(
        service.create(
          {
            nome: 'Y',
            tipo: TipoCliente.PF,
            cpfCnpj: '11144477735',
            email: 'y@x.com',
            telefone: '11',
            endereco: 'Rua',
          },
          'u',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('deve rejeitar email duplicado', async () => {
      tx.cliente.findFirst.mockResolvedValue(clienteRow({ email: 'dup@x.com' }));
      await expect(
        service.create(
          {
            nome: 'Y',
            tipo: TipoCliente.PF,
            cpfCnpj: '52998224725',
            email: 'dup@x.com',
            telefone: '11',
            endereco: 'Rua',
          },
          'u',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllPaginated', () => {
    it('deve retornar lista de clientes', async () => {
      prisma.cliente.findMany.mockResolvedValue([clienteRow()]);
      prisma.cliente.count.mockResolvedValue(1);
      const r = await service.findAllPaginated({ page: 1, limit: 10 });
      expect(r.items.length).toBe(1);
      expect(r.total).toBe(1);
    });

    it('deve retornar lista vazia se não houver clientes', async () => {
      prisma.cliente.findMany.mockResolvedValue([]);
      prisma.cliente.count.mockResolvedValue(0);
      const r = await service.findAllPaginated({});
      expect(r.items).toEqual([]);
      expect(r.total).toBe(0);
    });

    it('deve aplicar paginação (offset, limit)', async () => {
      prisma.cliente.findMany.mockResolvedValue([]);
      prisma.cliente.count.mockResolvedValue(0);
      await service.findAllPaginated({ page: 2, limit: 5 });
      expect(prisma.cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('deve retornar cliente pelo ID', async () => {
      const c = clienteRow();
      prisma.cliente.findFirst.mockResolvedValue(c);
      const r = await service.findOne('c1');
      expect(r).toEqual(c);
    });

    it('deve lançar NotFoundException se ID não existir', async () => {
      prisma.cliente.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('deve atualizar cliente', async () => {
      const cur = clienteRow();
      const upd = { ...cur, nome: 'Novo' };
      tx.cliente.findFirst.mockResolvedValue(cur);
      tx.cliente.update.mockResolvedValue(upd);

      const r = await service.update('c1', { nome: 'Novo' }, 'u1');
      expect(r.nome).toBe('Novo');
      expect(cache.del).toHaveBeenCalledWith('cliente:c1');
    });

    it('deve registrar auditoria em UPDATE', async () => {
      const cur = clienteRow();
      tx.cliente.findFirst.mockResolvedValue(cur);
      tx.cliente.update.mockResolvedValue(cur);

      await service.update('c1', { telefone: '11888888888' }, 'u1');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          tabela: 'clientes',
          acao: AcaoAuditoria.UPDATE,
        }),
      );
    });

    it('deve lançar NotFoundException se ID não existir', async () => {
      tx.cliente.findFirst.mockResolvedValue(null);
      await expect(service.update('bad', { nome: 'X' }, 'u')).rejects.toThrow(NotFoundException);
    });

    it('deve rejeitar cpfCnpj duplicado após update', async () => {
      tx.cliente.findFirst.mockResolvedValue(
        clienteRow({ tipo: TipoCliente.PJ, cpfCnpj: '12345678000195' }),
      );
      tx.cliente.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.update('c1', { cpfCnpj: '11222333000181' }, 'u'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deve aplicar soft delete no cliente', async () => {
      const cur = clienteRow();
      tx.cliente.findFirst.mockResolvedValue(cur);
      tx.cliente.update.mockResolvedValue({ ...cur, deletedAt: new Date() });

      const r = await service.remove('c1', 'u1');
      expect(r.removed).toBe(true);
      expect(cache.del).toHaveBeenCalled();
    });

    it('deve registrar auditoria em DELETE', async () => {
      const cur = clienteRow();
      tx.cliente.findFirst.mockResolvedValue(cur);
      tx.cliente.update.mockResolvedValue({ ...cur, deletedAt: new Date() });

      await service.remove('c1', 'u1');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          tabela: 'clientes',
          acao: AcaoAuditoria.DELETE,
        }),
      );
    });

    it('deve lançar NotFoundException se ID não existir', async () => {
      tx.cliente.findFirst.mockResolvedValue(null);
      await expect(service.remove('bad', 'u')).rejects.toThrow(NotFoundException);
    });
  });
});
