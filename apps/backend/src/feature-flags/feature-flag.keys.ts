/** Chaves conhecidas — alinhar com seed/migration feature_flags. */
export const FEATURE_FLAG_KEYS = {
  FISCAL_INTEGRATION_ENABLED: 'FISCAL_INTEGRATION_ENABLED',
  GATE_AUTO_APPROVE_ENABLED: 'GATE_AUTO_APPROVE_ENABLED',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS];

export type FeatureFlagRules = {
  /** Habilita apenas para CNPJs (14 dígitos, sem máscara). Vazio = todos. */
  cnpjAllowList?: string[];
  /** Restringe por tenantId portal. Vazio = todos. */
  tenantIds?: string[];
};

export type FeatureFlagEvalContext = {
  cnpj?: string;
  tenantId?: string;
};
