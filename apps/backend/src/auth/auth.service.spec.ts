import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('AuthService', () => {
  let service: AuthService;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const redis = {
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
    get: jest.fn(),
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
});
