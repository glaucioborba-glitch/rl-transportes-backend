import { ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagGuard } from './feature-flag.guard';
import { FeatureFlagService } from './feature-flag.service';
import { FEATURE_FLAG_KEYS } from './feature-flag.keys';
import { REQUIRE_FEATURE_FLAG_KEY } from './require-feature-flag.decorator';

describe('FeatureFlagGuard', () => {
  const flags = { isEnabled: jest.fn() };
  const reflector = new Reflector();
  const guard = new FeatureFlagGuard(reflector, flags as unknown as FeatureFlagService);

  const handlerRef = function handler() {};
  const classRef = function classRef() {};

  function buildContext(handlerFlag?: string): ExecutionContext {
    jest.spyOn(reflector, 'get').mockImplementation((key, target) => {
      if (key !== REQUIRE_FEATURE_FLAG_KEY) return undefined;
      if (target === handlerRef) return handlerFlag;
      return undefined;
    });
    return {
      getHandler: () => handlerRef,
      getClass: () => classRef,
      switchToHttp: () => ({
        getRequest: () => ({ user: { cpfCnpj: '19131243000197' } }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => jest.clearAllMocks());

  it('permite rota sem metadata de flag', async () => {
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });

  it('bloqueia quando flag desligada', async () => {
    flags.isEnabled.mockResolvedValue(false);
    await expect(
      guard.canActivate(buildContext(FEATURE_FLAG_KEYS.FISCAL_INTEGRATION_ENABLED)),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('permite quando flag ativa', async () => {
    flags.isEnabled.mockResolvedValue(true);
    await expect(
      guard.canActivate(buildContext(FEATURE_FLAG_KEYS.GATE_AUTO_APPROVE_ENABLED)),
    ).resolves.toBe(true);
  });
});
