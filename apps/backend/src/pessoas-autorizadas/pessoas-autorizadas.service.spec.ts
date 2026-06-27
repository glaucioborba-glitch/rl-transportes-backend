import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PessoasAutorizadasService } from './pessoas-autorizadas.service';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../auth/session/session.service';
import { PessoasPermissoesService } from '../pessoas-permissoes/pessoas-permissoes.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';

describe('PessoasAutorizadasService', () => {
  let service: PessoasAutorizadasService;
  let prisma: {
    cliente: { findFirst: jest.Mock };
    pessoaAutorizada: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      delete: jest.Mock;
      update: jest.Mock;
    };
  };
  let session: { setPessoaAutorizada: jest.Mock; getSession: jest.Mock };
  let permissoes: {
    mergeInput: jest.Mock;
    obterPermissoesAtivas: jest.Mock;
    minhasPermissoes: jest.Mock;
  };
  let auditoria: { registrar: jest.Mock };

  const cxCliente: CxPortalRequestUser = {
    sub: 'user-1',
    email: 'corp@empresa.com',
    cpfCnpj: '12345678000199',
    portalPapel: 'CLIENTE',
    tenantId: 'default',
    clienteId: 'cli-1',
    tokenVersion: 0,
    auth: 'portal',
    sid: 'sid-1',
  };

  beforeEach(async () => {
    prisma = {
      cliente: { findFirst: jest.fn().mockResolvedValue({ id: 'cli-1' }) },
      pessoaAutorizada: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
    };
    session = {
      setPessoaAutorizada: jest.fn().mockResolvedValue(true),
      getSession: jest.fn(),
    };
    permissoes = {
      mergeInput: jest.fn().mockReturnValue({
        podeCriarSolicitacao: true,
        podeAnexarDocumentos: true,
        podeAgendarTurno: true,
        podeVisualizarFinanceiro: false,
        podeAprovarOS: false,
        podeVerOS: true,
        podeAlterarDadosGate: false,
        podeGerarPDF: true,
        podeGerenciarPessoas: false,
      }),
      obterPermissoesAtivas: jest.fn().mockResolvedValue({
        podeCriarSolicitacao: true,
        podeGerenciarPessoas: false,
      }),
      minhasPermissoes: jest.fn(),
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PessoasAutorizadasService,
        { provide: PrismaService, useValue: prisma },
        { provide: SessionService, useValue: session },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('7d') },
        },
        { provide: PessoasPermissoesService, useValue: permissoes },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    }).compile();

    service = module.get(PessoasAutorizadasService);
  });

  it('cadastro PF → cria pessoa em lote', async () => {
    prisma.pessoaAutorizada.create = jest.fn().mockResolvedValue({});
    await service.criarEmLote('cli-1', [
      { nome: 'Ana', email: 'ana@x.com', cpf: '52998224725', telefone: '48999999999' },
      { nome: 'Bob', email: 'bob@x.com', cpf: '39053344705' },
    ]);
    expect(prisma.pessoaAutorizada.create).toHaveBeenCalledTimes(2);
  });

  it('validar por CPF → sessão Redis atualiza', async () => {
    prisma.pessoaAutorizada.findFirst.mockResolvedValue({
      id: 'p1',
      nome: 'Ana',
      email: 'a@x.com',
      telefone: '48999999999',
    });
    const out = await service.validarPessoaPorCpf(cxCliente, '529.982.247-25');
    expect(out.id).toBe('p1');
    expect(prisma.pessoaAutorizada.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cpf: '52998224725', clienteId: 'cli-1', ativo: true },
      }),
    );
  });

  it('CPF inválido ou não autorizado → UnauthorizedException', async () => {
    prisma.pessoaAutorizada.findFirst.mockResolvedValue(null);
    await expect(service.validarPessoaPorCpf(cxCliente, '52998224725')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('seleção de identidade → sessão Redis atualiza', async () => {
    prisma.pessoaAutorizada.findFirst.mockResolvedValue({
      id: 'p1',
      nome: 'Ana',
      email: 'a@x.com',
      telefone: '48999999999',
    });
    const out = await service.escolherPessoa(cxCliente, 'p1');
    expect(out.id).toBe('p1');
    expect(session.setPessoaAutorizada).toHaveBeenCalledWith(
      'user-1',
      'sid-1',
      expect.objectContaining({ id: 'p1', nome: 'Ana' }),
      expect.any(Number),
      expect.objectContaining({ podeCriarSolicitacao: true }),
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        dadosDepois: expect.objectContaining({
          evento: 'LOGIN_PESSOA_AUTORIZADA',
          clienteCNPJ: '12345678000199',
          pessoaId: 'p1',
          nome: 'Ana',
          email: 'a@x.com',
        }),
      }),
    );
  });

  it('bootstrap minhas-permissoes → envelope seguro sem pessoa', async () => {
    session.getSession.mockResolvedValue(null);
    const out = await service.bootstrapMinhasPermissoes(cxCliente);
    expect(out.sucesso).toBe(true);
    expect(out.pessoa).toBeNull();
    expect(out.precisaSelecionarPessoa).toBe(true);
    expect(out.permissoes).toEqual(
      expect.objectContaining({ podeCriarSolicitacao: true, podeVerOS: true }),
    );
  });

  it('bootstrap minhas-permissoes → lê sessão Redis sem erro 500', async () => {
    session.getSession.mockResolvedValue({
      pessoaAutorizada: { id: 'p1', nome: 'Ana', email: 'a@x.com', telefone: null },
      permissoesPessoa: { podeCriarSolicitacao: false, podeVerOS: true },
    });
    const out = await service.bootstrapMinhasPermissoes(cxCliente);
    expect(out.sucesso).toBe(true);
    expect(out.pessoa?.id).toBe('p1');
    expect(out.precisaSelecionarPessoa).toBe(false);
    expect(out.permissoes.podeCriarSolicitacao).toBe(false);
  });

  it('bootstrap minhas-permissoes → falha de DB retorna defaults e audita', async () => {
    session.getSession.mockResolvedValue({
      pessoaAutorizada: { id: 'p1', nome: 'Ana', email: 'a@x.com', telefone: null },
    });
    permissoes.obterPermissoesAtivas.mockRejectedValue(new ForbiddenException('inativa'));
    const out = await service.bootstrapMinhasPermissoes(cxCliente);
    expect(out.sucesso).toBe(true);
    expect(out.permissoes.podeCriarSolicitacao).toBe(true);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        dadosDepois: expect.objectContaining({ evento: 'FALHA_PERMISSAO_PORTAL' }),
      }),
    );
  });

  it('desativar pessoa → PATCH ativo=false', async () => {
    prisma.pessoaAutorizada.findUnique.mockResolvedValue({
      id: 'p1',
      clienteId: 'cli-1',
      ativo: true,
    });
    prisma.pessoaAutorizada.update.mockResolvedValue({ id: 'p1', ativo: false });
    const row = await service.atualizar(cxCliente, 'p1', { ativo: false });
    expect(row.ativo).toBe(false);
  });

  it('pessoa inexistente → NotFoundException', async () => {
    prisma.pessoaAutorizada.findFirst.mockResolvedValue(null);
    await expect(service.escolherPessoa(cxCliente, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('cliente não pode acessar outro clienteId', async () => {
    await expect(service.listarPorCliente(cxCliente, 'outro-cli')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
