import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AcaoAuditoria, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PasswordPolicyService } from '../common/security/password-policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SessionService } from './session/session.service';
import { DeviceService } from './session/device.service';
import { LoginTelemetryService } from '../security-center/login-telemetry.service';
import { TenantConfigService } from '../tenant/tenant-config.service';

/** CNPJ válido (testes) — mesmo formato armazenado em `User.cpfCnpj`. */
const DOC_TEST = '11000000000108';
const CPF_TEST = '52998224725';
const CPF_STORED = '00052998224725';
const TENANT_TEST = 'default';
const BF_KEY = `brute_force:login:${TENANT_TEST}:${DOC_TEST}`;

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: any) => Promise<unknown>) =>
      fn({ user: { create: jest.fn(), update: jest.fn() } }),
    ),
  };

  const redis = {
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    get: jest.fn(),
    setex: jest.fn(),
  };

  const auditoria = {
    registrar: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);
    redis.del.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: AuditoriaService, useValue: auditoria },
        {
          provide: PasswordPolicyService,
          useValue: { assertStrong: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string, d?: string) => {
              if (k === 'JWT_EXPIRES_IN') return '1h';
              if (k === 'JWT_REFRESH_EXPIRES_IN') return '7d';
              return d;
            }),
            getOrThrow: jest.fn((k: string) => {
              if (k === 'JWT_REFRESH_SECRET') return 'refresh-secret';
              return 'x';
            }),
          },
        },
        {
          provide: SessionService,
          useValue: {
            registerSession: jest.fn().mockResolvedValue({ sessionId: 'sid-1' }),
            removeSession: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: DeviceService,
          useValue: {
            extractHeaders: jest.fn().mockReturnValue({}),
            computeFingerprint: jest.fn().mockReturnValue('fp-1'),
          },
        },
        {
          provide: LoginTelemetryService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: TenantConfigService,
          useValue: {
            getParametrosSeguranca: jest.fn().mockResolvedValue({
              tentativasLoginAntesBloqueio: 5,
              duracaoBloqueioMin: 15,
              ttlSessaoHoras: 8,
            }),
            getParametrosSegurancaSync: jest.fn().mockReturnValue({
              tentativasLoginAntesBloqueio: 5,
              duracaoBloqueioMin: 15,
              ttlSessaoHoras: 8,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
    jest.clearAllMocks();
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);
    redis.del.mockResolvedValue(1);
    redis.get.mockResolvedValue(null);
    redis.setex.mockResolvedValue(undefined);
  });

  it('validateUser retorna null se senha errada', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: '1',
      cpfCnpj: DOC_TEST,
      email: 'a@a.com',
      password: await bcrypt.hash('ok', 4),
      role: Role.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const u = await service.validateUser(TENANT_TEST, DOC_TEST, 'wrong');
    expect(u).toBeNull();
  });

  it('login lança Unauthorized se credenciais inválidas', async () => {
    redis.get.mockResolvedValue(null);
    redis.incr.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login(TENANT_TEST, DOC_TEST, 'y')).rejects.toThrow(UnauthorizedException);
    expect(redis.incr).toHaveBeenCalledWith(BF_KEY);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('login bloqueia após 5 tentativas incorretas (Redis)', async () => {
    redis.get.mockResolvedValue('5');
    await expect(service.login(TENANT_TEST, DOC_TEST, 'x')).rejects.toThrow(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('login aplica TTL de 15 min na 5ª senha incorreta', async () => {
    redis.get.mockResolvedValue(null);
    redis.incr.mockResolvedValue(5);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login(TENANT_TEST, DOC_TEST, 'x')).rejects.toThrow(UnauthorizedException);
    expect(redis.expire).toHaveBeenCalledWith(BF_KEY, 900);
  });

  it('refresh falha quando tokenVersion do JWT não confere com o usuário', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'u1',
      cpfCnpj: DOC_TEST,
      email: 'a@a.com',
      role: Role.ADMIN,
      tv: 0,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      cpfCnpj: DOC_TEST,
      email: 'a@a.com',
      password: 'x',
      role: Role.ADMIN,
      tokenVersion: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(service.refresh('refresh-token')).rejects.toThrow(UnauthorizedException);
  });

  it('createUser cria em transação e registra auditoria INSERT em users', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const created = {
      id: 'new-id',
      cpfCnpj: DOC_TEST,
      email: 'n@n.com',
      password: 'hash',
      role: Role.CLIENTE,
      tokenVersion: 0,
      clienteId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const userCreate = jest.fn().mockResolvedValue(created);
    prisma.$transaction.mockImplementationOnce(async (fn: (tx: any) => Promise<unknown>) =>
      fn({ user: { create: userCreate, update: jest.fn() } }),
    );

    const r = await service.createUser(
      { cpfCnpj: DOC_TEST, email: 'n@n.com', password: 'senha12345', role: Role.CLIENTE },
      'admin-id',
      '127.0.0.1',
      'jest',
    );

    expect(r.email).toBe('n@n.com');
    expect(userCreate).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tabela: 'users',
        acao: AcaoAuditoria.INSERT,
        usuario: 'admin-id',
        registroId: 'new-id',
      }),
      expect.anything(),
    );
  });

  it('createUser lança Conflict se CPF/CNPJ já existe', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'x' });
    await expect(
      service.createUser(
        { cpfCnpj: DOC_TEST, email: 'x@x.com', password: 'senha12345', role: Role.CLIENTE },
        'admin',
        '127.0.0.1',
        'ua',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('login usa documento sanitizado de 14 dígitos (pipe corporativo)', async () => {
    redis.incr.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login(TENANT_TEST, '11000000000108', 'y')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { tenantId_cpfCnpj: { tenantId: TENANT_TEST, cpfCnpj: '11000000000108' } },
    });
  });

  it('login normaliza CPF mascarado antes da busca', async () => {
    redis.incr.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login(TENANT_TEST, '529.982.247-25', 'y')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { tenantId_cpfCnpj: { tenantId: TENANT_TEST, cpfCnpj: '00052998224725' } },
    });
  });

  it('login CNPJ sanitizado bate com User.cpfCnpj armazenado', async () => {
    redis.incr.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login(TENANT_TEST, '11.000.000/0001-08', 'y')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { tenantId_cpfCnpj: { tenantId: TENANT_TEST, cpfCnpj: '11000000000108' } },
    });
  });

  it('login rejeita perfil CLIENTE (somente intranet staff)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'c1',
      cpfCnpj: CPF_STORED,
      email: 'cliente@rl.com',
      password: await bcrypt.hash('ok', 4),
      role: Role.CLIENTE,
      tokenVersion: 0,
      tenantId: TENANT_TEST,
      clienteId: 'cli-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(service.login(TENANT_TEST, CPF_TEST, 'ok')).rejects.toThrow(
      /Acesso restrito a colaboradores/i,
    );
  });

  it('login staff registra auditoria LOGIN_INTRANET com CPF mascarado', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      cpfCnpj: CPF_STORED,
      email: 'admin@rl.com',
      password: await bcrypt.hash('ok', 4),
      role: Role.ADMIN,
      tokenVersion: 0,
      tenantId: TENANT_TEST,
      clienteId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await service.login(TENANT_TEST, '529.982.247-25', 'ok');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        dadosDepois: expect.objectContaining({
          event: 'LOGIN_INTRANET',
          cpfMascarado: '529.982.247-25',
          role: Role.ADMIN,
        }),
      }),
    );
  });

  it('logout incrementa tokenVersion em transação e registra auditoria', async () => {
    const userUpdate = jest.fn().mockResolvedValue({});
    prisma.$transaction.mockImplementationOnce(async (fn: (tx: any) => Promise<void>) =>
      fn({ user: { update: userUpdate, create: jest.fn() } }),
    );
    await service.logout('user-uuid', { ip: '127.0.0.1', userAgent: 'test-agent' });
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-uuid' },
        data: { tokenVersion: { increment: 1 } },
      }),
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '127.0.0.1', userAgent: 'test-agent' }),
      expect.anything(),
    );
  });
});
