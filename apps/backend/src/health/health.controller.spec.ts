import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('retorna ok quando database e redis respondem', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: jest.fn().mockResolvedValue(1) } },
        { provide: RedisService, useValue: { ping: jest.fn().mockResolvedValue('PONG') } },
      ],
    }).compile();
    const controller = module.get(HealthController);
    const r = await controller.check();
    expect(r.status).toBe('ok');
    expect(r.checks).toEqual({ database: true, redis: true });
  });

  it('retorna degraded se um dos serviços falha', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: jest.fn().mockRejectedValue(new Error('off')) } },
        { provide: RedisService, useValue: { ping: jest.fn().mockResolvedValue('PONG') } },
      ],
    }).compile();
    const controller = module.get(HealthController);
    const r = await controller.check();
    expect(r.status).toBe('degraded');
  });
});
