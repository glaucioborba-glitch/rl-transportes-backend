import { ConfigService } from '@nestjs/config';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { IntegracaoEventLogStore } from '../stores/integracao-event-log.store';
import type { WebhookSubscription } from '../stores/webhook-subscription.store';
import { WebhookSubscriptionStore } from '../stores/webhook-subscription.store';

describe('WebhookDeliveryService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as unknown as typeof fetch);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deliverSubscription faz retry e conclui na segunda tentativa', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const subs = new WebhookSubscriptionStore();
    const log = new IntegracaoEventLogStore();
    const auditoria = { registrar: jest.fn() } as unknown as AuditoriaService;
    const config = { get: () => undefined } as unknown as ConfigService;

    const delivery = new WebhookDeliveryService(subs, log, auditoria, config);

    const sub: WebhookSubscription = {
      id: 'w1',
      url: 'https://example.com/hook',
      secret: 'x'.repeat(20),
      eventos: ['gate.registrado'],
      createdAt: new Date().toISOString(),
    };

    const r = await delivery.deliverSubscription(sub, '{"tipo":"gate.registrado"}');
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
