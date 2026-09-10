export type IntegracaoOrigem = 'env' | 'tenant' | 'none';

export type TenantIntegracoesCredenciais = {
  googleVision?: {
    credentialsJson?: string;
    apiKey?: string;
  };
  whatsapp?: {
    enabled?: boolean;
    phoneNumberId?: string;
    accessToken?: string;
    businessAccountId?: string;
  };
  banking?: {
    provider?: string;
    apiBaseUrl?: string;
    apiToken?: string;
  };
  s3?: {
    bucket?: string;
    endpoint?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicBaseUrl?: string;
  };
};

export type IntegracoesCredenciaisPatch = {
  googleVision?: {
    credentialsJson?: string;
    apiKey?: string;
  };
  whatsapp?: {
    enabled?: boolean;
    phoneNumberId?: string;
    accessToken?: string;
    businessAccountId?: string;
  };
  banking?: {
    provider?: string;
    apiBaseUrl?: string;
    apiToken?: string;
  };
  s3?: {
    bucket?: string;
    endpoint?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    publicBaseUrl?: string;
  };
};

export type IntegrationEnvSnapshot = {
  googleCredentialsJson?: string;
  googleApplicationCredentials?: string;
  googleVisionApiKey?: string;
  whatsappEnabledDefined: boolean;
  whatsappEnabled: boolean;
  whatsappAccessToken?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  bankingProvider?: string;
  bankingApiBaseUrl?: string;
  bankingApiToken?: string;
  s3Bucket?: string;
  s3Endpoint?: string;
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3PublicBaseUrl?: string;
};

export type GoogleServiceAccountHint = {
  clientEmail: string;
  projectId?: string;
};

export type ResolvedGoogleVision = {
  origem: IntegracaoOrigem;
  lockedByEnv: boolean;
  configured: boolean;
  clientEmail?: string;
  credentials?: Record<string, unknown>;
  useApplicationDefault: boolean;
  apiKey?: string;
};

export type ResolvedWhatsapp = {
  origem: IntegracaoOrigem;
  lockedByEnv: boolean;
  enabled: boolean;
  configured: boolean;
  phoneNumberId?: string;
  accessToken?: string;
  businessAccountId?: string;
  accessTokenPresent: boolean;
  businessAccountIdPresent: boolean;
};

export type ResolvedBanking = {
  origem: IntegracaoOrigem;
  lockedByEnv: boolean;
  configured: boolean;
  provider: string;
  apiBaseUrl?: string;
  apiToken?: string;
};

export type ResolvedS3 = {
  origem: IntegracaoOrigem;
  lockedByEnv: boolean;
  configured: boolean;
  bucket?: string;
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicBaseUrl?: string;
};

function trimOrEmpty(value?: string | null): string {
  return value?.trim() ?? '';
}

function envDefined(env: NodeJS.ProcessEnv, key: string): boolean {
  return env[key] != null && String(env[key]).length > 0;
}

export function snapshotIntegrationEnv(env: NodeJS.ProcessEnv = process.env): IntegrationEnvSnapshot {
  const whatsappEnabledRaw = env.WHATSAPP_ENABLED;
  return {
    googleCredentialsJson: trimOrEmpty(env.GOOGLE_CREDENTIALS_JSON) || undefined,
    googleApplicationCredentials: trimOrEmpty(env.GOOGLE_APPLICATION_CREDENTIALS) || undefined,
    googleVisionApiKey: trimOrEmpty(env.GOOGLE_VISION_API_KEY) || trimOrEmpty(env.GOOGLE_API_KEY) || undefined,
    whatsappEnabledDefined: whatsappEnabledRaw != null && String(whatsappEnabledRaw).length > 0,
    whatsappEnabled: String(whatsappEnabledRaw ?? 'false').toLowerCase() === 'true',
    whatsappAccessToken: trimOrEmpty(env.WHATSAPP_ACCESS_TOKEN) || undefined,
    whatsappPhoneNumberId: trimOrEmpty(env.WHATSAPP_PHONE_NUMBER_ID) || undefined,
    whatsappBusinessAccountId: trimOrEmpty(env.WHATSAPP_BUSINESS_ACCOUNT_ID) || undefined,
    bankingProvider: (trimOrEmpty(env.BANK_PROVIDER) || 'sandbox').toLowerCase(),
    bankingApiBaseUrl: trimOrEmpty(env.BANK_API_BASE_URL) || undefined,
    bankingApiToken: trimOrEmpty(env.BANK_API_TOKEN) || undefined,
    s3Bucket: trimOrEmpty(env.AWS_S3_BUCKET) || undefined,
    s3Endpoint:
      trimOrEmpty(env.STORAGE_ENDPOINT) ||
      trimOrEmpty(env.S3_ENDPOINT) ||
      trimOrEmpty(env.R2_ENDPOINT) ||
      undefined,
    s3Region: trimOrEmpty(env.AWS_REGION) || undefined,
    s3AccessKeyId: trimOrEmpty(env.AWS_ACCESS_KEY_ID) || undefined,
    s3SecretAccessKey: trimOrEmpty(env.AWS_SECRET_ACCESS_KEY) || undefined,
    s3PublicBaseUrl: trimOrEmpty(env.STORAGE_PUBLIC_BASE_URL) || undefined,
  };
}

export function parseGoogleServiceAccountJson(raw: string): GoogleServiceAccountHint & {
  credentials: Record<string, unknown>;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JSON da conta de serviço Google inválido.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON da conta de serviço Google inválido.');
  }
  const obj = parsed as Record<string, unknown>;
  const type = typeof obj.type === 'string' ? obj.type : '';
  const clientEmail = typeof obj.client_email === 'string' ? obj.client_email.trim() : '';
  const privateKey = typeof obj.private_key === 'string' ? obj.private_key.trim() : '';
  if (type !== 'service_account' || !clientEmail || !privateKey) {
    throw new Error('Cole o JSON da service account (type, client_email e private_key).');
  }
  const projectId = typeof obj.project_id === 'string' ? obj.project_id.trim() : undefined;
  return { clientEmail, projectId, credentials: obj };
}

function applyOptionalString(
  current: string | undefined,
  incoming: string | undefined,
): string | undefined {
  if (incoming === undefined) return current;
  const next = incoming.trim();
  return next || undefined;
}

export function mergeIntegracoesCredenciais(
  current: TenantIntegracoesCredenciais | undefined,
  patch: IntegracoesCredenciaisPatch | undefined,
): TenantIntegracoesCredenciais {
  const base: TenantIntegracoesCredenciais = {
    googleVision: current?.googleVision ? { ...current.googleVision } : undefined,
    whatsapp: current?.whatsapp ? { ...current.whatsapp } : undefined,
    banking: current?.banking ? { ...current.banking } : undefined,
    s3: current?.s3 ? { ...current.s3 } : undefined,
  };
  if (!patch) return base;

  if (patch.googleVision) {
    const credentialsJson = applyOptionalString(
      base.googleVision?.credentialsJson,
      patch.googleVision.credentialsJson,
    );
    const apiKey = applyOptionalString(base.googleVision?.apiKey, patch.googleVision.apiKey);
    base.googleVision = credentialsJson || apiKey ? { credentialsJson, apiKey } : undefined;
  }

  if (patch.whatsapp) {
    const next = { ...(base.whatsapp ?? {}) };
    if (patch.whatsapp.enabled !== undefined) next.enabled = patch.whatsapp.enabled;
    next.phoneNumberId = applyOptionalString(next.phoneNumberId, patch.whatsapp.phoneNumberId);
    next.accessToken = applyOptionalString(next.accessToken, patch.whatsapp.accessToken);
    next.businessAccountId = applyOptionalString(
      next.businessAccountId,
      patch.whatsapp.businessAccountId,
    );
    base.whatsapp =
      next.enabled || next.phoneNumberId || next.accessToken || next.businessAccountId
        ? next
        : undefined;
  }

  if (patch.banking) {
    const next = { ...(base.banking ?? {}) };
    next.provider = applyOptionalString(next.provider, patch.banking.provider);
    next.apiBaseUrl = applyOptionalString(next.apiBaseUrl, patch.banking.apiBaseUrl);
    next.apiToken = applyOptionalString(next.apiToken, patch.banking.apiToken);
    base.banking = next.provider || next.apiBaseUrl || next.apiToken ? next : undefined;
  }

  if (patch.s3) {
    const next = { ...(base.s3 ?? {}) };
    next.bucket = applyOptionalString(next.bucket, patch.s3.bucket);
    next.endpoint = applyOptionalString(next.endpoint, patch.s3.endpoint);
    next.region = applyOptionalString(next.region, patch.s3.region);
    next.accessKeyId = applyOptionalString(next.accessKeyId, patch.s3.accessKeyId);
    next.secretAccessKey = applyOptionalString(next.secretAccessKey, patch.s3.secretAccessKey);
    next.publicBaseUrl = applyOptionalString(next.publicBaseUrl, patch.s3.publicBaseUrl);
    base.s3 =
      next.bucket ||
      next.endpoint ||
      next.region ||
      next.accessKeyId ||
      next.secretAccessKey ||
      next.publicBaseUrl
        ? next
        : undefined;
  }

  return base;
}

export function resolveGoogleVision(
  env: IntegrationEnvSnapshot,
  tenant?: TenantIntegracoesCredenciais['googleVision'],
): ResolvedGoogleVision {
  if (env.googleCredentialsJson) {
    try {
      const parsed = parseGoogleServiceAccountJson(env.googleCredentialsJson);
      return {
        origem: 'env',
        lockedByEnv: true,
        configured: true,
        clientEmail: parsed.clientEmail,
        credentials: parsed.credentials,
        useApplicationDefault: false,
      };
    } catch {
      return {
        origem: 'env',
        lockedByEnv: true,
        configured: false,
        useApplicationDefault: false,
      };
    }
  }
  if (env.googleApplicationCredentials) {
    return {
      origem: 'env',
      lockedByEnv: true,
      configured: true,
      useApplicationDefault: true,
    };
  }
  const json = tenant?.credentialsJson?.trim();
  if (json) {
    try {
      const parsed = parseGoogleServiceAccountJson(json);
      return {
        origem: 'tenant',
        lockedByEnv: false,
        configured: true,
        clientEmail: parsed.clientEmail,
        credentials: parsed.credentials,
        useApplicationDefault: false,
      };
    } catch {
      return {
        origem: 'none',
        lockedByEnv: false,
        configured: false,
        useApplicationDefault: false,
      };
    }
  }
  if (env.googleVisionApiKey) {
    return {
      origem: 'env',
      lockedByEnv: true,
      configured: true,
      useApplicationDefault: false,
      apiKey: env.googleVisionApiKey,
    };
  }
  const apiKey = tenant?.apiKey?.trim();
  if (apiKey) {
    return {
      origem: 'tenant',
      lockedByEnv: false,
      configured: true,
      useApplicationDefault: false,
      apiKey,
    };
  }
  return {
    origem: 'none',
    lockedByEnv: false,
    configured: false,
    useApplicationDefault: false,
  };
}

export function resolveWhatsapp(
  env: IntegrationEnvSnapshot,
  tenant?: TenantIntegracoesCredenciais['whatsapp'],
): ResolvedWhatsapp {
  const envToken = env.whatsappAccessToken;
  const lockedByEnv = Boolean(envToken);
  const accessToken = envToken || tenant?.accessToken?.trim() || undefined;
  const phoneNumberId =
    env.whatsappPhoneNumberId || tenant?.phoneNumberId?.trim() || undefined;
  const businessAccountId =
    env.whatsappBusinessAccountId || tenant?.businessAccountId?.trim() || undefined;
  const enabled = env.whatsappEnabledDefined
    ? env.whatsappEnabled
    : Boolean(tenant?.enabled) || env.whatsappEnabled;
  const origem: IntegracaoOrigem = envToken
    ? 'env'
    : accessToken || phoneNumberId || tenant?.enabled
      ? 'tenant'
      : 'none';
  return {
    origem,
    lockedByEnv,
    enabled,
    configured: Boolean(enabled && accessToken && phoneNumberId),
    phoneNumberId,
    accessToken,
    businessAccountId,
    accessTokenPresent: Boolean(accessToken),
    businessAccountIdPresent: Boolean(businessAccountId),
  };
}

export function resolveBanking(
  env: IntegrationEnvSnapshot,
  tenant?: TenantIntegracoesCredenciais['banking'],
): ResolvedBanking {
  const envToken = env.bankingApiToken;
  const lockedByEnv = Boolean(envToken || env.bankingApiBaseUrl);
  const provider = (
    envToken || env.bankingApiBaseUrl
      ? env.bankingProvider
      : tenant?.provider?.trim() || env.bankingProvider || 'sandbox'
  )?.toLowerCase() || 'sandbox';
  const apiBaseUrl = env.bankingApiBaseUrl || tenant?.apiBaseUrl?.trim() || undefined;
  const apiToken = envToken || tenant?.apiToken?.trim() || undefined;
  const origem: IntegracaoOrigem = envToken || env.bankingApiBaseUrl
    ? 'env'
    : apiToken || (tenant?.provider && tenant.provider !== 'sandbox')
      ? 'tenant'
      : 'none';
  return {
    origem,
    lockedByEnv,
    configured: provider !== 'sandbox' && Boolean(apiBaseUrl && apiToken),
    provider,
    apiBaseUrl,
    apiToken,
  };
}

export function resolveS3(
  env: IntegrationEnvSnapshot,
  tenant?: TenantIntegracoesCredenciais['s3'],
): ResolvedS3 {
  const envConfigured = Boolean(env.s3Bucket && env.s3AccessKeyId && env.s3SecretAccessKey);
  if (envConfigured) {
    return {
      origem: 'env',
      lockedByEnv: true,
      configured: true,
      bucket: env.s3Bucket,
      endpoint: env.s3Endpoint,
      region: env.s3Region,
      accessKeyId: env.s3AccessKeyId,
      secretAccessKey: env.s3SecretAccessKey,
      publicBaseUrl: env.s3PublicBaseUrl,
    };
  }
  const bucket = tenant?.bucket?.trim() || undefined;
  const accessKeyId = tenant?.accessKeyId?.trim() || undefined;
  const secretAccessKey = tenant?.secretAccessKey?.trim() || undefined;
  const configured = Boolean(bucket && accessKeyId && secretAccessKey);
  return {
    origem: configured ? 'tenant' : bucket || tenant?.endpoint ? 'tenant' : 'none',
    lockedByEnv: false,
    configured,
    bucket,
    endpoint: tenant?.endpoint?.trim() || env.s3Endpoint,
    region: tenant?.region?.trim() || env.s3Region || 'us-east-1',
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: tenant?.publicBaseUrl?.trim() || env.s3PublicBaseUrl,
  };
}

export function sanitizeTenantParametrosForClient<T extends Record<string, unknown>>(
  parametros: T,
): T {
  const { integracoesCredenciais: _creds, nfse, ...rest } = parametros as T & {
    integracoesCredenciais?: unknown;
    nfse?: { certificadoBase64?: string; certificadoSenha?: string };
  };
  return {
    ...rest,
    ...(nfse
      ? {
          nfse: {
            certificadoPresente: Boolean(nfse.certificadoBase64?.trim()),
          },
        }
      : {}),
  } as T;
}
