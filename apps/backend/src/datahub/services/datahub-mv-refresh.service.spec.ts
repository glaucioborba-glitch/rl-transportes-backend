import { DatahubMvRefreshService } from './datahub-mv-refresh.service';

describe('DatahubMvRefreshService', () => {
  it('refreshAll percorre todas as MVs do Datahub', async () => {
    const executeRawUnsafe = jest.fn().mockResolvedValue(undefined);
    const prisma = { $executeRawUnsafe: executeRawUnsafe };
    const svc = new DatahubMvRefreshService(prisma as never);

    const out = await svc.refreshAll();

    expect(out.ok).toBe(true);
    expect(out.views).toHaveLength(7);
    expect(executeRawUnsafe).toHaveBeenCalled();
    expect(svc.getLastRefreshAt()).toBeTruthy();
  });
});
