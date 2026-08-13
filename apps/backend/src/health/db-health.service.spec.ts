import { DbHealthService } from './db-health.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('DbHealthService', () => {
  it('retorna healthy com latência baixa', async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ count: 5n }]),
    } as unknown as PrismaService;
    const svc = new DbHealthService(prisma);
    const r = await svc.checkConnection();
    expect(r.status).toBe('healthy');
    expect(r.activeConnections).toBe(5);
  });

  it('retorna unhealthy em falha de query', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as PrismaService;
    const svc = new DbHealthService(prisma);
    const r = await svc.checkConnection();
    expect(r.status).toBe('unhealthy');
  });
});
