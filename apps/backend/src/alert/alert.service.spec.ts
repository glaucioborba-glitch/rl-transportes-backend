import { AlertService } from './alert.service';

describe('AlertService', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'ALERT_WEBHOOK_URL') return '';
      return undefined;
    }),
  };

  it('fiscalIpmDown loga sem webhook configurado', async () => {
    const svc = new AlertService(config as never);
    await expect(svc.fiscalIpmDown({ reason: 'timeout' })).resolves.toBeUndefined();
  });
});
