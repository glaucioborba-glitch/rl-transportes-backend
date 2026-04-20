import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AcaoAuditoria, Prisma, TipoCliente } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ClientesService', () => {
  let service: ClientesService;

  const auditoria = { registrar: jest.fn().mockResolvedValue({}) };

  const prisma = {
    $transaction: jest.fn(),
    cliente: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const tx = {
    cliente: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    prisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>, _opts?: unknown) =>
      fn(tx),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    }).compile();

    service = module.get(ClientesService);
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>, _opts?: unknown) =>
      fn(tx),
    );
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

  const ctx = { ip: '127.0.0.1', ua: 'jest' };

  describe('create', () => {
    it('deve criar cliente PF válido', async () => {
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
        ctx.ip,
        ctx.ua,
      );

      expect(tx.cliente.create).toHaveBeenCalled();
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tabela: 'clientes',
          acao: AcaoAuditoria.INSERT,
          usuario: 'user-1',
        }),
        tx,
      );
    });

    it('deve registrar auditoria em INSERT', async () => {
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
        ctx.ip,
        ctx.ua,
      );
      expect(auditoria.registrar).toHaveBeenCalled();
    });

    it('deve rejeitar cpfCnpj duplicado', async () => {
      prisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
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
          ctx.ip,
          ctx.ua,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('deve retornar lista de clientes', async () => {
      prisma.cliente.findMany.mockResolvedValue([clienteRow()]);
      prisma.cliente.count.mockResolvedValue(1);
      const r = await service.findAll(1, 10);
      expect(r.data.length).toBe(1);
      expect(r.pagination.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('deve retornar cliente pelo ID', async () => {
      const c = { ...clienteRow(), solicitacoes: [] };
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
      prisma.cliente.findUnique.mockResolvedValue(cur);
      tx.cliente.update.mockResolvedValue(upd);

      const r = await service.update('c1', { nome: 'Novo' }, 'u1', ctx.ip, ctx.ua);
      expect(r.nome).toBe('Novo');
    });

    it('deve registrar auditoria em UPDATE', async () => {
      const cur = clienteRow();
      prisma.cliente.findUnique.mockResolvedValue(cur);
      tx.cliente.update.mockResolvedValue(cur);

      await service.update('c1', { telefone: '11888888888' }, 'u1', ctx.ip, ctx.ua);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tabela: 'clientes',
          acao: AcaoAuditoria.UPDATE,
        }),
        tx,
      );
    });

    it('deve lançar NotFoundException se ID não existir', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);
      await expect(service.update('bad', { nome: 'X' }, 'u', ctx.ip, ctx.ua)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deve aplicar soft delete no cliente', async () => {
      const cur = clienteRow();
      prisma.cliente.findUnique.mockResolvedValue(cur);
      tx.cliente.update.mockResolvedValue({ ...cur, deletedAt: new Date() });

      const r = await service.remove('c1', 'u1', ctx.ip, ctx.ua);
      expect(r.removed).toBe(true);
    });

    it('deve registrar auditoria em DELETE', async () => {
      const cur = clienteRow();
      prisma.cliente.findUnique.mockResolvedValue(cur);
      tx.cliente.update.mockResolvedValue({ ...cur, deletedAt: new Date() });

      await service.remove('c1', 'u1', ctx.ip, ctx.ua);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          tabela: 'clientes',
          acao: AcaoAuditoria.DELETE,
        }),
        tx,
      );
    });

    it('deve lançar NotFoundException se ID não existir', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);
      await expect(service.remove('bad', 'u', ctx.ip, ctx.ua)).rejects.toThrow(NotFoundException);
    });
  });
});
