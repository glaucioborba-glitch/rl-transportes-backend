import { FeatureFlagService } from './feature-flag.service';

describe('FeatureFlagService', () => {
  const prisma = {
    featureFlag: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const cache = {
    key: jest.fn((p: string, id: string) => `${p}:${id}`),
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
  };

  const svc = new FeatureFlagService(prisma as never, cache as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('isEnabled false quando flag ausente', async () => {
    cache.get.mockResolvedValue(null);
    prisma.featureFlag.findUnique.mockResolvedValue(null);
    await expect(svc.isEnabled('FISCAL_INTEGRATION_ENABLED')).resolves.toBe(false);
  });

  it('isEnabled respeita cnpjAllowList', async () => {
    const row = {
      chave: 'GATE_AUTO_APPROVE_ENABLED',
      ativo: true,
      regras: { cnpjAllowList: ['19131243000197'] },
    };
    cache.get.mockResolvedValue(row);
    await expect(
      svc.isEnabled('GATE_AUTO_APPROVE_ENABLED', { cnpj: '19131243000197' }),
    ).resolves.toBe(true);
    await expect(
      svc.isEnabled('GATE_AUTO_APPROVE_ENABLED', { cnpj: '00000000000191' }),
    ).resolves.toBe(false);
  });

  it('upsert invalida cache', async () => {
    prisma.featureFlag.upsert.mockResolvedValue({ chave: 'X', ativo: true });
    await svc.upsert('X', { ativo: true });
    expect(cache.invalidate).toHaveBeenCalledWith('feature-flag:X');
  });
});
