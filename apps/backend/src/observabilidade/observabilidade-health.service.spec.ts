import { ObservabilidadeHealthService } from './observabilidade-health.service';

describe('ObservabilidadeHealthService', () => {
  it('detalhado retorna FAIL quando banco falha', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('db')),
    };
    const redis = {
      ping: jest.fn().mockResolvedValue('PONG'),
    };
    const config = { get: jest.fn().mockReturnValue(undefined) } as never;

    const svc = new ObservabilidadeHealthService(prisma as never, redis as never, config);
    const d = await svc.detalhado();
    expect(d.sinal).toBe('FAIL');
  });

  it('detalhado retorna OK quando DB e Redis ok', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(1) };
    const redis = { ping: jest.fn().mockResolvedValue('PONG') };
    const config = { get: jest.fn().mockReturnValue(undefined) } as never;

    const svc = new ObservabilidadeHealthService(prisma as never, redis as never, config);
    const d = await svc.detalhado();
    expect(d.sinal).toBe('OK');
    expect(d.banco.ok).toBe(true);
    expect(d.redis.ok).toBe(true);
  });
});
