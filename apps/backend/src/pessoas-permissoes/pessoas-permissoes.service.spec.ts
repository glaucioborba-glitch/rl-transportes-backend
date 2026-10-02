import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PessoasPermissoesService } from './pessoas-permissoes.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { SecurityEventsService } from '../security-center/security-events.service';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import { defaultPermissoesPessoa } from './pessoa-permissoes.types';

describe('PessoasPermissoesService', () => {
  let service: PessoasPermissoesService;
  let prisma: {
    pessoaAutorizada: { findUnique: jest.Mock; findFirst: jest.Mock };
    permissaoPessoaAutorizada: {
      findUnique: jest.Mock;
      create: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditoria: { registrar: jest.Mock };
  let securityEvents: { emit: jest.Mock };

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
    pessoaAutorizada: {
      id: 'p1',
      nome: 'Ana',
      email: 'ana@x.com',
      telefone: '48999999999',
    },
  };

  beforeEach(async () => {
    prisma = {
      pessoaAutorizada: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      permissaoPessoaAutorizada: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    securityEvents = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PessoasPermissoesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: SecurityEventsService, useValue: securityEvents },
      ],
    }).compile();

    service = module.get(PessoasPermissoesService);
  });

  it('pessoa sem permissão criar solicitação → 403', async () => {
    prisma.pessoaAutorizada.findUnique.mockResolvedValue({
      id: 'p1',
      ativo: true,
      permissoes: { ...defaultPermissoesPessoa(), podeCriarSolicitacao: false },
    });
    await expect(
      service.assertPermissao(cxCliente, ['criarSolicitacao']),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(securityEvents.emit).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'LOG_EVENTO_PERMISSAO_NEGADA' }),
    );
  });

  it('pessoa com permissão criar solicitação → ok', async () => {
    prisma.pessoaAutorizada.findUnique.mockResolvedValue({
      id: 'p1',
      ativo: true,
      permissoes: defaultPermissoesPessoa(),
    });
    const out = await service.assertPermissao(cxCliente, ['criarSolicitacao']);
    expect(out.podeCriarSolicitacao).toBe(true);
  });

  it('pessoa sem permissão visualizar financeiro → 403', async () => {
    prisma.pessoaAutorizada.findUnique.mockResolvedValue({
      id: 'p1',
      ativo: true,
      permissoes: { ...defaultPermissoesPessoa(), podeVisualizarFinanceiro: false },
    });
    await expect(
      service.assertPermissao(cxCliente, ['visualizarFinanceiro']),
    ).rejects.toThrow('Seu perfil não possui permissão para executar esta ação.');
  });

  it('pessoa sem permissão gate → 403', async () => {
    prisma.pessoaAutorizada.findUnique.mockResolvedValue({
      id: 'p1',
      ativo: true,
      permissoes: { ...defaultPermissoesPessoa(), podeAlterarDadosGate: false },
    });
    await expect(service.assertPermissao(cxCliente, ['alterarGate'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('pessoa com permissão aprovar OS → ok', async () => {
    prisma.pessoaAutorizada.findUnique.mockResolvedValue({
      id: 'p1',
      ativo: true,
      permissoes: { ...defaultPermissoesPessoa(), podeAprovarOS: true },
    });
    const out = await service.assertPermissao(cxCliente, ['aprovarOS']);
    expect(out.podeAprovarOS).toBe(true);
  });

  it('pessoa desativada → bloqueada imediatamente', async () => {
    prisma.pessoaAutorizada.findUnique.mockResolvedValue({
      id: 'p1',
      ativo: false,
      permissoes: defaultPermissoesPessoa(),
    });
    await expect(service.assertPermissao(cxCliente, ['criarSolicitacao'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('auditoria registra permissaoNegada', async () => {
    prisma.pessoaAutorizada.findUnique.mockResolvedValue({
      id: 'p1',
      ativo: true,
      permissoes: { ...defaultPermissoesPessoa(), podeCriarSolicitacao: false },
    });
    await expect(service.assertPermissao(cxCliente, ['criarSolicitacao'], {
      originalUrl: '/v2/solicitacoes',
    } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        dadosDepois: expect.objectContaining({
          evento: 'LOG_EVENTO_PERMISSAO_NEGADA',
          permissaoNegada: 'criarSolicitacao',
        }),
      }),
    );
  });

  it('staff ignora verificação de permissão', async () => {
    const staff: CxPortalRequestUser = { ...cxCliente, portalPapel: 'STAFF', staffRole: 'ADMIN' };
    const out = await service.assertPermissao(staff, ['criarSolicitacao']);
    expect(out.podeCriarSolicitacao).toBe(true);
    expect(prisma.pessoaAutorizada.findUnique).not.toHaveBeenCalled();
  });

  it('pessoa inexistente → NotFoundException ao obter registro', async () => {
    prisma.pessoaAutorizada.findUnique.mockResolvedValue(null);
    await expect(service.obterRegistroPorPessoaId('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
