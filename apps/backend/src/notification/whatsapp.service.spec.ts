import { ConfigService } from '@nestjs/config';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService', () => {
  it('modo sandbox quando WHATSAPP_ENABLED=false', async () => {
    const config = {
      get: (key: string) => {
        const map: Record<string, unknown> = {
          'whatsapp.enabled': false,
          'whatsapp.accessToken': '',
          'whatsapp.phoneNumberId': '',
          'whatsapp.provider': 'meta',
        };
        return map[key];
      },
    } as unknown as ConfigService;

    const svc = new WhatsappService(config);
    const res = await svc.sendTemplate({
      toE164: '+5511999990000',
      templateName: 'rl_test',
      bodyParameters: ['A', 'B'],
    });

    expect(res.mode).toBe('sandbox');
    expect(res.messageId).toMatch(/^sandbox-/);
  });
});
