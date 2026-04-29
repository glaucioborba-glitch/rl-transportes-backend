import { ConfigService } from '@nestjs/config';
import { PlataformaApiClientStore } from './stores/plataforma-api-client.store';
import { PlataformaRateLimitService } from './services/plataforma-rate-limit.service';
import type { PlataformaApiClient } from './plataforma.types';
import { PlataformaContractsService } from './services/plataforma-contracts.service';

describe('PlataformaApiClientStore (validarSecret)', () => {
  it('aceita secret correto', () => {
    const store = new PlataformaApiClientStore({ get: () => '' } as unknown as ConfigService);
    const client = {
      secret: 'segredo-forte',
    } as PlataformaApiClient;
    expect(store.validarSecret(client, 'segredo-forte')).toBe(true);
    expect(store.validarSecret(client, 'errado')).toBe(false);
  });
});

describe('PlataformaRateLimitService', () => {
  it('bloqueia após exceder rpm', () => {
    const rl = new PlataformaRateLimitService();
    const client = { id: 'c1', requestsPerMinute: 2 } as PlataformaApiClient;
    expect(rl.consume(client)).toBe(true);
    expect(rl.consume(client)).toBe(true);
    expect(rl.consume(client)).toBe(false);
  });
});

describe('PlataformaContractsService', () => {
  it('retorna schema envelope e webhooks', () => {
    const s = new PlataformaContractsService();
    expect((s.obterSchema('envelope') as { properties?: unknown }).properties).toBeDefined();
    expect(s.webhookContratos().length).toBeGreaterThanOrEqual(5);
  });
});
