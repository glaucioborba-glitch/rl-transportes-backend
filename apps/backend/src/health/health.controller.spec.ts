import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckError,
  HealthCheckService,
  type HealthCheckResult,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { IpmHealthIndicator } from './indicators/ipm.health';

describe('HealthController', () => {
  const okResult: HealthCheckResult = {
    status: 'ok',
    info: {
      database: { status: 'up' },
      redis: { status: 'up' },
    },
    error: {},
    details: {
      database: { status: 'up' },
      redis: { status: 'up' },
    },
  };

  async function buildController(checkImpl: () => Promise<HealthCheckResult>) {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: { check: jest.fn(checkImpl) } },
        { provide: PrismaHealthIndicator, useValue: { ping: jest.fn() } },
        { provide: RedisHealthIndicator, useValue: { ping: jest.fn() } },
        { provide: IpmHealthIndicator, useValue: { ping: jest.fn() } },
        { provide: PrismaService, useValue: { $queryRaw: jest.fn() } },
        { provide: RedisService, useValue: { ping: jest.fn() } },
      ],
    }).compile();
    return module.get(HealthController);
  }

  it('retorna ok quando database e redis respondem', async () => {
    const controller = await buildController(async () => okResult);
    const r = await controller.check();
    expect(r.status).toBe('ok');
    expect(r.info?.database).toEqual({ status: 'up' });
    expect(r.info?.redis).toEqual({ status: 'up' });
  });

  it('propaga falha Terminus quando dependência está down', async () => {
    const controller = await buildController(async () => {
      throw new HealthCheckError('degraded', {
        database: { status: 'down', message: 'off' },
      });
    });
    await expect(controller.check()).rejects.toBeInstanceOf(HealthCheckError);
  });
});
