import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AcaoAuditoria, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

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
      ],
    }).compile();

    service = module.get(AuthService);
    jwtService = module.get(JwtService);
    jest.clearAllMocks();
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(1);
    redis.del.mockResolvedValue(1);
  });

  it('validateUser retorna null se senha errada', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: '1',
      email: 'a@a.com',
      password: await bcrypt.hash('ok', 4),
      role: Role.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const u = await service.validateUser('a@a.com', 'wrong');
    expect(u).toBeNull();
  });

  it('login lança Unauthorized se credenciais inválidas', async () => {
    redis.incr.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login('x@x.com', 'y')).rejects.toThrow(UnauthorizedException);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('login lança 429 após mais de 5 tentativas', async () => {
    redis.incr.mockResolvedValue(6);
    const err = await service.login('a@a.com', 'x').then(
      () => {
        throw new Error('esperava rejeição');
      },
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('refresh falha quando tokenVersion do JWT não confere com o usuário', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'u1',
      email: 'a@a.com',
      role: Role.ADMIN,
      tv: 0,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
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
      { email: 'n@n.com', password: 'senha12345', role: Role.CLIENTE },
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

  it('createUser lança Conflict se e-mail já existe', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'x' });
    await expect(
      service.createUser(
        { email: 'x@x.com', password: 'senha12345', role: Role.CLIENTE },
        'admin',
        '127.0.0.1',
        'ua',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('logout incrementa tokenVersion em transação e registra auditoria', async () => {
    const userUpdate = jest.fn().mockResolvedValue({});
    prisma.$transaction.mockImplementationOnce(async (fn: (tx: any) => Promise<void>) =>
      fn({ user: { update: userUpdate, create: jest.fn() } }),
    );
    await service.logout('user-uuid');
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-uuid' },
        data: { tokenVersion: { increment: 1 } },
      }),
    );
    expect(auditoria.registrar).toHaveBeenCalled();
  });
});
