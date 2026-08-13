import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { CxPortalRateLimitService } from './cx-portal-rate-limit.service';
import { RedisService } from '../../redis/redis.service';

describe('CxPortalRateLimitService', () => {
  let service: CxPortalRateLimitService;
  let redis: jest.Mocked<Pick<RedisService, 'incr' | 'expire'>>;

  beforeEach(() => {
    redis = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };
    service = new CxPortalRateLimitService(redis as unknown as RedisService);
  });

  function mockReq(url: string): Request {
    return {
      url,
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as Request;
  }

  it('minhas-permissoes — permite até 10 req/min via Redis', async () => {
    const req = mockReq('/portal/auth/minhas-permissoes');
    for (let i = 0; i < 10; i++) {
      redis.incr.mockResolvedValueOnce(i + 1);
      await expect(service.poke(req, { sub: 'u1' } as never)).resolves.toBeUndefined();
    }
  });

  it('minhas-permissoes — bloqueia após limite', async () => {
    const req = mockReq('/portal/auth/minhas-permissoes');
    redis.incr.mockResolvedValue(11);
    await expect(service.poke(req, { sub: 'u2' } as never)).rejects.toThrow(HttpException);
    try {
      await service.poke(req, { sub: 'u2' } as never);
    } catch (e) {
      expect((e as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('outras rotas portal — bucket separado', async () => {
    const permReq = mockReq('/portal/auth/minhas-permissoes');
    redis.incr.mockResolvedValue(11);
    await expect(service.poke(permReq, { sub: 'u3' } as never)).rejects.toThrow(HttpException);

    const otherReq = mockReq('/cliente/portal/kpis');
    redis.incr.mockResolvedValue(1);
    await expect(service.poke(otherReq, { sub: 'u3' } as never)).resolves.toBeUndefined();
  });
});
