import { ConfigService } from '@nestjs/config';
import { PlataformaApiClientStore } from './stores/plataforma-api-client.store';
import { PlataformaRateLimitService } from './services/plataforma-rate-limit.service';
import type { PlataformaApiClient } from './plataforma.types';
import { PlataformaContractsService } from './services/plataforma-contracts.service';
import { ConfigCacheService } from '../common/cache/config-cache.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlataformaApiClientStore (validarSecret)', () => {
  it('aceita secret correto', () => {
    const store = new PlataformaApiClientStore(
      { get: () => '' } as unknown as ConfigService,
      {} as PrismaService,
      { get: jest.fn(), set: jest.fn(), invalidate: jest.fn(), key: (_p: string, id: string) => `mock:${id}` } as unknown as ConfigCacheService,
    );
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
