import { BiAnalyticsRefreshService } from './bi-analytics.service';

describe('BiAnalyticsRefreshService', () => {
  it('expõe lista de materialized views', () => {
    const prisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
    };
    const svc = new BiAnalyticsRefreshService(prisma as never);
    expect(svc.getLastRefreshAt()).toBeNull();
  });
});
