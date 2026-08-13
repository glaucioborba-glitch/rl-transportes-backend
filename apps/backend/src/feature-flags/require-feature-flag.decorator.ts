import { SetMetadata } from '@nestjs/common';
import type { FeatureFlagKey } from './feature-flag.keys';

export const REQUIRE_FEATURE_FLAG_KEY = 'requireFeatureFlag';

/** Protege rota/handler — exige feature flag ativa (com regras JSON opcionais). */
export const RequireFeatureFlag = (chave: FeatureFlagKey | string) =>
  SetMetadata(REQUIRE_FEATURE_FLAG_KEY, chave);
