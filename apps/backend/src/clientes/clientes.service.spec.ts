import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AcaoAuditoria, Prisma, Role, TipoCliente } from '@prisma/client';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AddressService } from '../common/address/address.service';
import type { NormalizedPostalAddress } from '../common/address/address.service';
import type { PostalAddressInput } from '../common/address/address.service';
import { ClientesService } from './clientes.service';
import { SessionService } from '../auth/session/session.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateClienteDto } from './dto/create-cliente.dto';

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

  function mockNormalize(input: PostalAddressInput): NormalizedPostalAddress {
    const cep = input.cep.replace(/\D/g, '');
    return {
      cep,
      logradouro: input.logradouro?.trim() || 'Rua Mock',
      bairro: input.bairro?.trim() || 'Centro',
      cidade: input.cidade?.trim() || 'São Paulo',
      uf: (input.uf?.trim() || 'SP').toUpperCase(),
      numero: input.numero?.trim() || '10',
      complemento: input.complemento?.trim() ? input.complemento.trim() : null,
      codigoIbge: input.codigoIbge?.replace(/\D/g, '').padStart(7, '0') || '3550308',
    };
  }

  const addressService = {
    normalize: jest.fn().mockImplementation(async (x: PostalAddressInput) => mockNormalize(x)),
  };

  const sessionService = {
    getSession: jest.fn().mockResolvedValue({
      permissoesPessoa: { podeGerenciarPessoas: true },
    }),
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
        { provide: AddressService, useValue: addressService },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    service = module.get(ClientesService);
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>, _opts?: unknown) =>
      fn(tx),
    );
  });

  const dtoPf = (): CreateClienteDto => ({
    nomeCompleto: 'Maria Silva',
    tipo: TipoCliente.PF,
    cpfCnpj: '52998224725',
    dataNascimento: '1990-05-15',
    email: 'x@x.com',
    telefone: '11999999999',
    enderecoLogradouro: 'Rua',
    enderecoNumero: '10',
    enderecoBairro: 'Centro',
    enderecoCidade: 'São Paulo',
    enderecoUf: 'SP',
    enderecoCep: '01310100',
    codigoMunicipioIbge: '3550308',
  });

  const clienteRow = (over: Partial<Record<string, unknown>> = {}) => ({
    id: 'c1',
    razaoSocial: 'Maria Silva',
    tipo: TipoCliente.PF,
    cpfCnpj: '52998224725'.padStart(14, '0'),
    dataNascimento: new Date('1990-05-15T12:00:00.000Z'),
    nomeFantasia: null,
    inscricaoMunicipal: null,
    inscricaoEstadual: null,
    isentoIE: false,
    email: 'x@x.com',
    emailNfse: 'x@x.com',
    telefone: '11999999999',
    enderecoLogradouro: 'Rua',
    enderecoNumero: '10',
    enderecoComplemento: null,
    enderecoBairro: 'Centro',
    enderecoCidade: 'São Paulo',
    enderecoUf: 'SP',
    enderecoCep: '01310100',
    codigoMunicipioIbge: '3550308',
    regimeTributario: null,
    descricaoAtividade: null,
    cnae: null,
    responsavel: null,
    responsavelTelefone: null,
    responsavelEmail: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...over,
  });

  const ctx = { ip: '127.0.0.1', ua: 'jest' };

  describe('create', () => {
    it('deve criar cliente PF válido', async () => {
      tx.cliente.create.mockResolvedValue(clienteRow());

      await service.create(dtoPf(), 'user-1', ctx.ip, ctx.ua);

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
      await service.create(dtoPf(), 'u', ctx.ip, ctx.ua);
      expect(auditoria.registrar).toHaveBeenCalled();
    });

    it('deve rejeitar cpfCnpj duplicado', async () => {
      prisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(service.create({ ...dtoPf(), email: 'y@x.com' }, 'u', ctx.ip, ctx.ua)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAllPaginated', () => {
    it('deve retornar lista de clientes', async () => {
      prisma.cliente.findMany.mockResolvedValue([clienteRow()]);
      prisma.cliente.count.mockResolvedValue(1);
      const r = await service.findAllPaginated({ page: 1, limit: 10 });
      expect(r.data.length).toBe(1);
      expect(r.pagination.total).toBe(1);
    });

    it('CLIENTE só vê o próprio cadastro (filtro por id)', async () => {
      prisma.cliente.findMany.mockResolvedValue([clienteRow({ id: 'c-own' })]);
      prisma.cliente.count.mockResolvedValue(1);
      await service.findAllPaginated(
        { page: 1, limit: 10 },
        {
          sub: 'u',
          id: 'u',
          cpfCnpj: '11000000000108',
          email: 'a@a.com',
          role: Role.CLIENTE,
          permissions: [],
          clienteId: 'c-own',
        },
      );
      expect(prisma.cliente.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'c-own',
            deletedAt: null,
          }),
        }),
      );
    });

    it('CLIENTE sem clienteId recebe ForbiddenException', async () => {
      await expect(
        service.findAllPaginated(
          { page: 1, limit: 10 },
          {
            sub: 'u',
            id: 'u',
            cpfCnpj: '11000000000108',
            email: 'a@a.com',
            role: Role.CLIENTE,
            permissions: [],
            clienteId: null,
          },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('deve retornar cliente pelo ID', async () => {
      const c = { ...clienteRow(), solicitacoes: [] };
      prisma.cliente.findFirst.mockResolvedValue(c);
      const r = await service.findOne('c1');
      expect(r).toEqual(c);
    });

    it('CLIENTE só acessa o próprio id', async () => {
      const c = { ...clienteRow({ id: 'c-own' }), solicitacoes: [] };
      prisma.cliente.findFirst.mockResolvedValue(c);
      const r = await service.findOne('c-own', {
        sub: 'u',
        id: 'u',
        cpfCnpj: '11000000000108',
        email: 'a@a.com',
        role: Role.CLIENTE,
        permissions: [],
        clienteId: 'c-own',
      });
      expect(r).toEqual(c);
    });

    it('CLIENTE recebe Forbidden ao consultar id de outro cadastro (com auditoria)', async () => {
      prisma.cliente.findFirst.mockResolvedValue({
        id: 'outro',
        razaoSocial: 'Outro',
        tipo: TipoCliente.PJ,
        cpfCnpj: '11222333000181',
        email: 'o@o.com',
        solicitacoes: [],
      });
      await expect(
        service.findOne('outro', {
          sub: 'u',
          id: 'u',
          cpfCnpj: '11000000000108',
          email: 'a@a.com',
          role: Role.CLIENTE,
          permissions: [],
          clienteId: 'c-own',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(auditoria.registrar).toHaveBeenCalled();
    });

    it('CLIENTE sem clienteId recebe ForbiddenException', async () => {
      await expect(
        service.findOne('c1', {
          sub: 'u',
          id: 'u',
          cpfCnpj: '11000000000108',
          email: 'a@a.com',
          role: Role.CLIENTE,
          permissions: [],
          clienteId: null,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('deve lançar NotFoundException se ID não existir', async () => {
      prisma.cliente.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('deve atualizar cliente', async () => {
      const cur = clienteRow();
      const upd = { ...cur, razaoSocial: 'Novo' };
      prisma.cliente.findUnique.mockResolvedValue(cur);
      tx.cliente.update.mockResolvedValue(upd);

      const r = await service.update('c1', { nomeCompleto: 'Novo' }, 'u1', ctx.ip, ctx.ua);
      expect(r.razaoSocial).toBe('Novo');
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
      await expect(service.update('bad', { razaoSocial: 'X' }, 'u', ctx.ip, ctx.ua)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve rejeitar alteração de cpfCnpj no PATCH', async () => {
      prisma.cliente.findUnique.mockResolvedValue(clienteRow());
      await expect(
        service.update('c1', { cpfCnpj: '11000000000199' }, 'u1', ctx.ip, ctx.ua),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve exigir podeGerenciarPessoas para CLIENTE alterar cadastro', async () => {
      prisma.cliente.findUnique.mockResolvedValue(clienteRow());
      sessionService.getSession.mockResolvedValueOnce({
        permissoesPessoa: { podeGerenciarPessoas: false },
      });
      await expect(
        service.update(
          'c1',
          { razaoSocial: 'Novo' },
          'u1',
          ctx.ip,
          ctx.ua,
          {
            sub: 'u1',
            id: 'u1',
            email: 'a@a.com',
            cpfCnpj: '11000000000108',
            role: Role.CLIENTE,
            permissions: [],
            clienteId: 'c1',
            sid: 'sess-1',
          },
        ),
      ).rejects.toThrow(ForbiddenException);
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
