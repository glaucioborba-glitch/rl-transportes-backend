import { ConfigService } from '@nestjs/config';
import { ComercialPricingService } from './comercial-pricing.service';

describe('ComercialPricingService', () => {
  const prisma = {};
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'PERFORMANCE_CUSTO_MINUTO_PROXY') return '0.05';
      return undefined;
    }),
  };

  const service = new ComercialPricingService(prisma as never, config as never);

  it('getSimulador delega ao motor what-if', () => {
    const r = service.getSimulador({
      precoAtual: 200,
      precoNovo: 220,
      custo: 80,
      volumeAtual: 50,
    });
    expect(r.receitaAtual).toBe(10000);
    expect(r.elasticidadeAplicada).toBeDefined();
  });
});
