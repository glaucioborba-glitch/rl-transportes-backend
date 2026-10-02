import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService.checkTemplateStatus', () => {
  it('retorna approved em sandbox quando desabilitado', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'whatsapp.enabled') return false;
        return undefined;
      }),
    } as unknown as ConfigService;
    const integrationCreds = {
      peekWhatsapp: () => ({ enabled: false }),
      resolveWhatsapp: async () => ({
        enabled: false,
        configured: false,
        origem: 'none',
        lockedByEnv: false,
        accessTokenPresent: false,
        businessAccountIdPresent: false,
      }),
    };
    const svc = new WhatsappService(config, integrationCreds as never);
    const r = await svc.checkTemplateStatus('dunning_pre_vencimento');
    expect(r.approved).toBe(true);
    expect(r.status).toBe('sandbox');
  });
});
