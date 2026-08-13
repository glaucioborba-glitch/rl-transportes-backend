import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { RedisService } from './redis.service';

const mockRedis = {
  status: 'ready' as string,
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  incr: jest.fn(),
  pexpire: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
};

jest.mock('ioredis', () => jest.fn().mockImplementation(() => mockRedis));

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.status = 'ready';
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.pexpire.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue(null);

    const mod = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: string) => {
              if (key === 'REDIS_HOST') return 'localhost';
              if (key === 'REDIS_PORT') return '6379';
              if (key === 'REDIS_OPTIONAL') return '1';
              if (key === 'NODE_ENV') return 'development';
              return def;
            },
          },
        },
      ],
    }).compile();

    service = mod.get(RedisService);
  });

  it('safeGet retorna null quando chave ausente', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    await expect(service.safeGet('missing')).resolves.toBeNull();
  });

  it('safeGet faz parse JSON', async () => {
    mockRedis.get.mockResolvedValueOnce(JSON.stringify({ ok: true }));
    await expect(service.safeGet<{ ok: boolean }>('k')).resolves.toEqual({ ok: true });
  });

  it('checkRateLimit usa Redis quando conectado', async () => {
    mockRedis.incr.mockResolvedValueOnce(1);
    await expect(service.checkRateLimit('rl:test', 5, 60_000)).resolves.toBe(true);
    expect(mockRedis.incr).toHaveBeenCalledWith('rl:test');
    expect(mockRedis.pexpire).toHaveBeenCalledWith('rl:test', 60_000);
  });

  it('checkRateLimit faz fallback in-memory quando Redis falha', async () => {
    mockRedis.incr.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(service.checkRateLimit('rl:fallback', 2, 60_000)).resolves.toBe(true);
    await expect(service.checkRateLimit('rl:fallback', 2, 60_000)).resolves.toBe(true);
    await expect(service.checkRateLimit('rl:fallback', 2, 60_000)).resolves.toBe(false);
    expect(service.isMemoryFallback()).toBe(true);
  });
});
