export type IntegracaoOrigem = 'env' | 'tenant' | 'none';

/** Quando o Emissor Nacional entra em campo. */
export type AtivacaoNfseNacional = 'DESLIGADO' | 'CONTINGENCIA' | 'SEMPRE';

export type NfseNacionalCredenciais = {
  ambiente?: 'homologacao' | 'producao';
  ativacao?: AtivacaoNfseNacional;
  /** Certificado A1 (PFX em base64) — é a chave de acesso da integração. */
  certificadoPfxBase64?: string;
  certificadoSenha?: string;
  cnpjPrestador?: string;
  inscricaoMunicipal?: string;
  municipioIbge?: string;
  serieDps?: string;
  /** Código de tributação nacional do serviço (cTribNac). */
  codigoTributacaoNacional?: string;
  aliquotaIssPercent?: number;
  /** 1 = MEI, 2 = ME/EPP do Simples, 3 = fora do Simples. */
  optanteSimplesNacional?: number;
  regimeEspecialTributacao?: number;
};

/** NFS-e municipal via IPM/Atende.Net. Dados fiscais são de cada terminal. */
export type IpmCredenciais = {
  baseUrl?: string;
  prestadorCnpj?: string;
  /** Código do município do prestador no Atende.Net (TOM). */
  prestadorTom?: string;
  /** Senha do portal da prefeitura (usuário = CNPJ). Sem ela, o sistema fica em sandbox. */
  senha?: string;
  municipioIbge?: string;
  tagIndicadorCancelamento?: string;
  /** Certificado A1 (PFX em base64) para o mTLS com a prefeitura. */
  certificadoPfxBase64?: string;
  certificadoSenha?: string;
  /** Serviço de armazenagem no XML. */
  codigoLocalPrestacao?: string;
  codigoAtividade?: string;
  codigoItemListaServico?: string;
  aliquotaPercent?: number;
  situacaoTributaria?: string;
  tomadorTomFallback?: string;
};

export type TenantIntegracoesCredenciais = {
  googleVision?: {
    credentialsJson?: string;
    apiKey?: string;
  };
  ipm?: IpmCredenciais;
  nfseNacional?: NfseNacionalCredenciais;
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
  boleto?: {
    apiBaseUrl?: string;
    apiToken?: string;
  };
  pix?: {
    apiBaseUrl?: string;
    apiToken?: string;
    chavePix?: string;
  };
  googleMaps?: {
    apiKey?: string;
  };
  googleRoutes?: {
    apiKey?: string;
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
  ipm?: IpmCredenciais;
  nfseNacional?: NfseNacionalCredenciais;
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
  boleto?: {
    apiBaseUrl?: string;
    apiToken?: string;
  };
  pix?: {
    apiBaseUrl?: string;
    apiToken?: string;
    chavePix?: string;
  };
  googleMaps?: {
    apiKey?: string;
  };
  googleRoutes?: {
    apiKey?: string;
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
  pixApiBaseUrl?: string;
  pixApiToken?: string;
  pixChave?: string;
  googleMapsApiKey?: string;
  googleRoutesApiKey?: string;
  googleMapsTerminalLat?: string;
  googleMapsTerminalLng?: string;
  s3Bucket?: string;
  s3Endpoint?: string;
  s3Region?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  s3PublicBaseUrl?: string;
  nfseNacionalAmbiente?: string;
  nfseNacionalCertBase64?: string;
  nfseNacionalCertSenha?: string;
  ipmBaseUrl?: string;
  ipmPrestadorCnpj?: string;
  ipmPrestadorTom?: string;
  ipmSenha?: string;
  ipmMunicipioIbge?: string;
  ipmCertPath?: string;
  ipmCertPass?: string;
  ipmTagCancel?: string;
  ipmArmCodigoLocal?: string;
  ipmArmCodigoAtividade?: string;
  ipmArmCodigoItem?: string;
  ipmArmAliquota?: string;
  ipmArmSitTrib?: string;
  ipmTomadorTomFallback?: string;
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

export type ResolvedPix = {
  origem: IntegracaoOrigem;
  lockedByEnv: boolean;
  configured: boolean;
  apiBaseUrl?: string;
  apiToken?: string;
  chavePix?: string;
  chavePixPresent: boolean;
};

export type ResolvedGoogleMaps = {
  origem: IntegracaoOrigem;
  lockedByEnv: boolean;
  configured: boolean;
  apiKey?: string;
  terminalLat?: number;
  terminalLng?: number;
};

export type ResolvedGoogleRoutes = {
  origem: IntegracaoOrigem;
  lockedByEnv: boolean;
  configured: boolean;
  apiKey?: string;
};

export type ResolvedIpm = {
  origem: IntegracaoOrigem;
  lockedByEnv: boolean;
  /** Transmite de verdade (tem senha do portal). Sem senha, o sistema fica em sandbox. */
  configured: boolean;
  baseUrl: string;
  prestadorCnpj: string;
  prestadorTom: string;
  senha: string;
  senhaPresente: boolean;
  municipioIbge: string;
  tagIndicadorCancelamento: string;
  /** PFX em base64 (terminal) ou arquivo do servidor. */
  certificadoPfxBase64?: string;
  certificadoCaminho?: string;
  certificadoSenha: string;
  certificadoPresente: boolean;
  armazenagem: {
    codigoLocalPrestacao: string;
    codigoAtividade: string;
    codigoItemListaServico: string;
    aliquotaPercent: number;
    situacaoTributaria: string;
  };
  tomadorTomFallback: string;
};

export type ResolvedNfseNacional = {
  origem: IntegracaoOrigem;
  lockedByEnv: boolean;
  /** Pronto para emitir: certificado + CNPJ + município. */
  configured: boolean;
  ativacao: AtivacaoNfseNacional;
  ambiente: 'homologacao' | 'producao';
  certificadoPfxBase64?: string;
  certificadoSenha?: string;
  certificadoPresente: boolean;
  cnpjPrestador?: string;
  inscricaoMunicipal?: string;
  municipioIbge?: string;
  serieDps: string;
  codigoTributacaoNacional?: string;
  aliquotaIssPercent: number;
  optanteSimplesNacional: number;
  regimeEspecialTributacao: number;
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
    pixApiBaseUrl: trimOrEmpty(env.PIX_API_BASE_URL) || undefined,
    pixApiToken: trimOrEmpty(env.PIX_API_TOKEN) || undefined,
    pixChave: trimOrEmpty(env.PIX_CHAVE) || trimOrEmpty(env.BANK_PIX_CHAVE) || undefined,
    googleMapsApiKey: trimOrEmpty(env.GOOGLE_MAPS_API_KEY) || undefined,
    googleRoutesApiKey: trimOrEmpty(env.GOOGLE_ROUTES_API_KEY) || undefined,
    googleMapsTerminalLat: trimOrEmpty(env.GOOGLE_MAPS_TERMINAL_LAT) || undefined,
    googleMapsTerminalLng: trimOrEmpty(env.GOOGLE_MAPS_TERMINAL_LNG) || undefined,
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
    nfseNacionalAmbiente: trimOrEmpty(env.NFSE_NACIONAL_AMBIENTE) || undefined,
    nfseNacionalCertBase64: trimOrEmpty(env.NFSE_NACIONAL_CERT_BASE64) || undefined,
    nfseNacionalCertSenha: trimOrEmpty(env.NFSE_NACIONAL_CERT_SENHA) || undefined,
    ipmBaseUrl: trimOrEmpty(env.NFSE_IPM_BASE_URL) || undefined,
    ipmPrestadorCnpj: trimOrEmpty(env.NFSE_IPM_PRESTADOR_CNPJ) || undefined,
    ipmPrestadorTom: trimOrEmpty(env.NFSE_IPM_PRESTADOR_TOM) || undefined,
    ipmSenha: trimOrEmpty(env.NFSE_IPM_SENHA) || undefined,
    ipmMunicipioIbge: trimOrEmpty(env.NFSE_IPM_MUNICIPIO_IBGE) || undefined,
    ipmCertPath: trimOrEmpty(env.NFSE_IPM_CERT_PATH) || undefined,
    ipmCertPass: trimOrEmpty(env.NFSE_IPM_CERT_PASS) || undefined,
    ipmTagCancel: trimOrEmpty(env.NFSE_IPM_TAG_CANCEL) || undefined,
    ipmArmCodigoLocal: trimOrEmpty(env.NFSE_ARM_CODIGO_LOCAL) || undefined,
    ipmArmCodigoAtividade: trimOrEmpty(env.NFSE_ARM_CODIGO_ATIVIDADE) || undefined,
    ipmArmCodigoItem: trimOrEmpty(env.NFSE_ARM_CODIGO_ITEM) || undefined,
    ipmArmAliquota: trimOrEmpty(env.NFSE_ARM_ALIQUOTA) || undefined,
    ipmArmSitTrib: trimOrEmpty(env.NFSE_ARM_SIT_TRIB) || undefined,
    ipmTomadorTomFallback: trimOrEmpty(env.NFSE_TOMADOR_TOM_FALLBACK) || undefined,
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

export function parseCoord(value?: string | null): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export function maskPixKey(chave?: string | null): string | undefined {
  const t = chave?.trim();
  if (!t) return undefined;
  if (t.includes('@')) {
    const [user, domain] = t.split('@');
    const u = user.slice(0, 1) || '*';
    return `${u}***@${domain}`;
  }
  if (t.length <= 4) return '****';
  return `${'*'.repeat(t.length - 4)}${t.slice(-4)}`;
}

export function mergeIntegracoesCredenciais(
  current: TenantIntegracoesCredenciais | undefined,
  patch: IntegracoesCredenciaisPatch | undefined,
): TenantIntegracoesCredenciais {
  const legacyBanking = current?.banking as
    | { chavePix?: string; apiBaseUrl?: string; apiToken?: string }
    | undefined;
  const base: TenantIntegracoesCredenciais = {
    googleVision: current?.googleVision ? { ...current.googleVision } : undefined,
    ipm: current?.ipm ? { ...current.ipm } : undefined,
    nfseNacional: current?.nfseNacional ? { ...current.nfseNacional } : undefined,
    whatsapp: current?.whatsapp ? { ...current.whatsapp } : undefined,
    boleto: current?.boleto
      ? { ...current.boleto }
      : legacyBanking
        ? { apiBaseUrl: legacyBanking.apiBaseUrl, apiToken: legacyBanking.apiToken }
        : undefined,
    pix: current?.pix
      ? { ...current.pix }
      : legacyBanking?.chavePix
        ? { chavePix: legacyBanking.chavePix }
        : undefined,
    googleMaps: current?.googleMaps ? { apiKey: current.googleMaps.apiKey } : undefined,
    googleRoutes: current?.googleRoutes ? { ...current.googleRoutes } : undefined,
    s3: current?.s3 ? { ...current.s3 } : undefined,
  };
  base.banking = base.boleto;
  if (!patch) return base;

  if (patch.googleVision) {
    const credentialsJson = applyOptionalString(
      base.googleVision?.credentialsJson,
      patch.googleVision.credentialsJson,
    );
    const apiKey = applyOptionalString(base.googleVision?.apiKey, patch.googleVision.apiKey);
    base.googleVision = credentialsJson || apiKey ? { credentialsJson, apiKey } : undefined;
  }

  if (patch.ipm) {
    const p = patch.ipm;
    const next: IpmCredenciais = { ...(base.ipm ?? {}) };
    next.baseUrl = applyOptionalString(next.baseUrl, p.baseUrl);
    next.prestadorCnpj = applyOptionalString(next.prestadorCnpj, p.prestadorCnpj);
    next.prestadorTom = applyOptionalString(next.prestadorTom, p.prestadorTom);
    // Senha e certificado só mudam quando reenviados; vazio apaga.
    next.senha = applyOptionalString(next.senha, p.senha);
    next.municipioIbge = applyOptionalString(next.municipioIbge, p.municipioIbge);
    next.tagIndicadorCancelamento = applyOptionalString(
      next.tagIndicadorCancelamento,
      p.tagIndicadorCancelamento,
    );
    next.certificadoPfxBase64 = applyOptionalString(
      next.certificadoPfxBase64,
      p.certificadoPfxBase64,
    );
    next.certificadoSenha = applyOptionalString(next.certificadoSenha, p.certificadoSenha);
    next.codigoLocalPrestacao = applyOptionalString(
      next.codigoLocalPrestacao,
      p.codigoLocalPrestacao,
    );
    next.codigoAtividade = applyOptionalString(next.codigoAtividade, p.codigoAtividade);
    next.codigoItemListaServico = applyOptionalString(
      next.codigoItemListaServico,
      p.codigoItemListaServico,
    );
    next.situacaoTributaria = applyOptionalString(next.situacaoTributaria, p.situacaoTributaria);
    next.tomadorTomFallback = applyOptionalString(next.tomadorTomFallback, p.tomadorTomFallback);
    if (p.aliquotaPercent !== undefined) next.aliquotaPercent = p.aliquotaPercent;
    base.ipm = Object.values(next).some((v) => v !== undefined) ? next : undefined;
  }

  if (patch.nfseNacional) {
    const p = patch.nfseNacional;
    const next: NfseNacionalCredenciais = { ...(base.nfseNacional ?? {}) };
    // Certificado e senha só mudam quando reenviados; vazio apaga.
    next.certificadoPfxBase64 = applyOptionalString(
      next.certificadoPfxBase64,
      p.certificadoPfxBase64,
    );
    next.certificadoSenha = applyOptionalString(next.certificadoSenha, p.certificadoSenha);
    next.cnpjPrestador = applyOptionalString(next.cnpjPrestador, p.cnpjPrestador);
    next.inscricaoMunicipal = applyOptionalString(next.inscricaoMunicipal, p.inscricaoMunicipal);
    next.municipioIbge = applyOptionalString(next.municipioIbge, p.municipioIbge);
    next.serieDps = applyOptionalString(next.serieDps, p.serieDps);
    next.codigoTributacaoNacional = applyOptionalString(
      next.codigoTributacaoNacional,
      p.codigoTributacaoNacional,
    );
    if (p.ambiente !== undefined) next.ambiente = p.ambiente;
    if (p.ativacao !== undefined) next.ativacao = p.ativacao;
    if (p.aliquotaIssPercent !== undefined) next.aliquotaIssPercent = p.aliquotaIssPercent;
    if (p.optanteSimplesNacional !== undefined) {
      next.optanteSimplesNacional = p.optanteSimplesNacional;
    }
    if (p.regimeEspecialTributacao !== undefined) {
      next.regimeEspecialTributacao = p.regimeEspecialTributacao;
    }
    base.nfseNacional = Object.values(next).some((v) => v !== undefined) ? next : undefined;
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

  if (patch.boleto || patch.banking) {
    const incoming = patch.boleto ?? patch.banking;
    const next = { ...(base.boleto ?? {}) };
    next.apiBaseUrl = applyOptionalString(next.apiBaseUrl, incoming?.apiBaseUrl);
    next.apiToken = applyOptionalString(next.apiToken, incoming?.apiToken);
    base.boleto = next.apiBaseUrl || next.apiToken ? next : undefined;
    base.banking = base.boleto;
  }

  if (patch.pix) {
    const next = { ...(base.pix ?? {}) };
    next.apiBaseUrl = applyOptionalString(next.apiBaseUrl, patch.pix.apiBaseUrl);
    next.apiToken = applyOptionalString(next.apiToken, patch.pix.apiToken);
    next.chavePix = applyOptionalString(next.chavePix, patch.pix.chavePix);
    base.pix = next.apiBaseUrl || next.apiToken || next.chavePix ? next : undefined;
  }

  if (patch.googleMaps) {
    const apiKey = applyOptionalString(base.googleMaps?.apiKey, patch.googleMaps.apiKey);
    base.googleMaps = apiKey ? { apiKey } : undefined;
  }

  if (patch.googleRoutes) {
    const apiKey = applyOptionalString(base.googleRoutes?.apiKey, patch.googleRoutes.apiKey);
    base.googleRoutes = apiKey ? { apiKey } : undefined;
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
  tenant?: TenantIntegracoesCredenciais['boleto'] | TenantIntegracoesCredenciais['banking'],
): ResolvedBanking {
  const envToken = env.bankingApiToken;
  const lockedByEnv = Boolean(envToken || env.bankingApiBaseUrl);
  const apiBaseUrl = env.bankingApiBaseUrl || tenant?.apiBaseUrl?.trim() || undefined;
  const apiToken = envToken || tenant?.apiToken?.trim() || undefined;
  const configured = Boolean(apiBaseUrl && apiToken);
  const origem: IntegracaoOrigem = envToken || env.bankingApiBaseUrl
    ? 'env'
    : configured
      ? 'tenant'
      : 'none';
  return {
    origem,
    lockedByEnv,
    configured,
    provider: configured ? 'api' : 'sandbox',
    apiBaseUrl,
    apiToken,
  };
}

export function resolvePix(
  env: IntegrationEnvSnapshot,
  tenant?: TenantIntegracoesCredenciais['pix'],
): ResolvedPix {
  const envToken = env.pixApiToken;
  const lockedByEnv = Boolean(envToken || env.pixApiBaseUrl);
  const apiBaseUrl = env.pixApiBaseUrl || tenant?.apiBaseUrl?.trim() || undefined;
  const apiToken = envToken || tenant?.apiToken?.trim() || undefined;
  const chavePix = env.pixChave || tenant?.chavePix?.trim() || undefined;
  const configured = Boolean(apiBaseUrl && apiToken);
  const origem: IntegracaoOrigem = envToken || env.pixApiBaseUrl
    ? 'env'
    : configured || chavePix
      ? 'tenant'
      : 'none';
  return {
    origem,
    lockedByEnv,
    configured,
    apiBaseUrl,
    apiToken,
    chavePix,
    chavePixPresent: Boolean(chavePix),
  };
}

export function resolveGoogleMaps(
  env: IntegrationEnvSnapshot,
  tenant?: TenantIntegracoesCredenciais['googleMaps'],
): ResolvedGoogleMaps {
  const envKey = env.googleMapsApiKey;
  const apiKey = envKey || tenant?.apiKey?.trim() || undefined;
  const lat = parseCoord(env.googleMapsTerminalLat);
  const lng = parseCoord(env.googleMapsTerminalLng);
  const origem: IntegracaoOrigem = envKey ? 'env' : apiKey ? 'tenant' : 'none';
  return {
    origem,
    lockedByEnv: Boolean(envKey),
    configured: Boolean(apiKey),
    apiKey,
    terminalLat: lat,
    terminalLng: lng,
  };
}

export function resolveGoogleRoutes(
  env: IntegrationEnvSnapshot,
  tenant?: TenantIntegracoesCredenciais['googleRoutes'],
): ResolvedGoogleRoutes {
  const envKey = env.googleRoutesApiKey;
  const apiKey = envKey || tenant?.apiKey?.trim() || undefined;
  return {
    origem: envKey ? 'env' : apiKey ? 'tenant' : 'none',
    lockedByEnv: Boolean(envKey),
    configured: Boolean(apiKey),
    apiKey,
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

function numeroOu(valor: unknown, padrao: number): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

/** Defaults históricos do IPM (Navegantes-SC), mantidos para não mudar o que já roda. */
export const IPM_PADRAO = {
  baseUrl: 'https://ws-navegantes.atende.net:7443/?pg=rest&service=WNERestServiceNFSe',
  prestadorCnpj: '27692077000126',
  prestadorTom: '8221',
  municipioIbge: '4211306',
  tagIndicadorCancelamento: 'tipo',
  codigoLocalPrestacao: '8221',
  codigoAtividade: '4930201',
  codigoItemListaServico: '160201',
  aliquotaPercent: 2,
  situacaoTributaria: '0',
  tomadorTomFallback: '8221',
} as const;

/** Certificado gravado antes desta tela, em parametros.nfse. */
export type IpmCertificadoLegado = {
  certificadoBase64?: string;
  certificadoSenha?: string;
};

/**
 * IPM/Atende.Net: o .env do servidor tem prioridade (instalação inteira);
 * sem ele, cada terminal usa a própria senha, certificado e dados fiscais.
 */
export function resolveIpm(
  env: IntegrationEnvSnapshot,
  tenant?: IpmCredenciais,
  legado?: IpmCertificadoLegado,
): ResolvedIpm {
  const lockedByEnv = Boolean(env.ipmSenha);
  const escolher = (doEnv: string | undefined, doTenant: string | undefined, padrao: string) =>
    doEnv?.trim() || doTenant?.trim() || padrao;

  const senha = lockedByEnv ? (env.ipmSenha ?? '') : (tenant?.senha ?? '');
  const certificadoPfxBase64 = lockedByEnv
    ? undefined
    : tenant?.certificadoPfxBase64?.trim() || legado?.certificadoBase64?.trim() || undefined;
  const certificadoCaminho = env.ipmCertPath?.trim() || undefined;
  const certificadoSenha = certificadoCaminho
    ? (env.ipmCertPass ?? '')
    : (tenant?.certificadoSenha ?? legado?.certificadoSenha ?? '');

  const temAlgoDoTenant = Boolean(
    tenant && Object.values(tenant).some((v) => v !== undefined && v !== ''),
  );

  return {
    origem: lockedByEnv ? 'env' : temAlgoDoTenant ? 'tenant' : 'none',
    lockedByEnv,
    configured: Boolean(senha),
    baseUrl: escolher(env.ipmBaseUrl, tenant?.baseUrl, IPM_PADRAO.baseUrl),
    prestadorCnpj: escolher(
      env.ipmPrestadorCnpj,
      tenant?.prestadorCnpj,
      IPM_PADRAO.prestadorCnpj,
    ).replace(/\D/g, ''),
    prestadorTom: escolher(env.ipmPrestadorTom, tenant?.prestadorTom, IPM_PADRAO.prestadorTom),
    senha,
    senhaPresente: Boolean(senha),
    municipioIbge: escolher(env.ipmMunicipioIbge, tenant?.municipioIbge, IPM_PADRAO.municipioIbge),
    tagIndicadorCancelamento:
      escolher(
        env.ipmTagCancel,
        tenant?.tagIndicadorCancelamento,
        IPM_PADRAO.tagIndicadorCancelamento,
      ).replace(/[^a-zA-Z0-9_]/g, '') || IPM_PADRAO.tagIndicadorCancelamento,
    certificadoPfxBase64,
    certificadoCaminho,
    certificadoSenha,
    certificadoPresente: Boolean(certificadoPfxBase64 || certificadoCaminho),
    armazenagem: {
      codigoLocalPrestacao: escolher(
        env.ipmArmCodigoLocal,
        tenant?.codigoLocalPrestacao,
        IPM_PADRAO.codigoLocalPrestacao,
      ),
      codigoAtividade: escolher(
        env.ipmArmCodigoAtividade,
        tenant?.codigoAtividade,
        IPM_PADRAO.codigoAtividade,
      ),
      codigoItemListaServico: escolher(
        env.ipmArmCodigoItem,
        tenant?.codigoItemListaServico,
        IPM_PADRAO.codigoItemListaServico,
      ),
      aliquotaPercent: numeroOu(
        env.ipmArmAliquota ?? tenant?.aliquotaPercent,
        IPM_PADRAO.aliquotaPercent,
      ),
      situacaoTributaria: escolher(
        env.ipmArmSitTrib,
        tenant?.situacaoTributaria,
        IPM_PADRAO.situacaoTributaria,
      ),
    },
    tomadorTomFallback: escolher(
      env.ipmTomadorTomFallback,
      tenant?.tomadorTomFallback,
      IPM_PADRAO.tomadorTomFallback,
    ),
  };
}

/**
 * NFS-e Emissor Nacional: o certificado do .env trava a integração para toda a
 * instalação; sem ele, cada terminal usa o próprio certificado e os próprios dados fiscais.
 */
export function resolveNfseNacional(
  env: IntegrationEnvSnapshot,
  tenant?: NfseNacionalCredenciais,
): ResolvedNfseNacional {
  const lockedByEnv = Boolean(env.nfseNacionalCertBase64);
  const certificadoPfxBase64 = lockedByEnv
    ? env.nfseNacionalCertBase64
    : tenant?.certificadoPfxBase64?.trim() || undefined;
  const certificadoSenha = lockedByEnv
    ? env.nfseNacionalCertSenha
    : tenant?.certificadoSenha ?? undefined;

  const cnpjPrestador = tenant?.cnpjPrestador?.replace(/\D/g, '') || undefined;
  const municipioIbge = tenant?.municipioIbge?.replace(/\D/g, '') || undefined;
  const configured = Boolean(certificadoPfxBase64 && cnpjPrestador && municipioIbge);
  const ativacao: AtivacaoNfseNacional =
    tenant?.ativacao === 'SEMPRE' || tenant?.ativacao === 'CONTINGENCIA'
      ? tenant.ativacao
      : 'DESLIGADO';

  return {
    origem: lockedByEnv ? 'env' : certificadoPfxBase64 || cnpjPrestador ? 'tenant' : 'none',
    lockedByEnv,
    configured,
    ativacao,
    ambiente:
      String(tenant?.ambiente ?? env.nfseNacionalAmbiente ?? '').toLowerCase() === 'producao'
        ? 'producao'
        : 'homologacao',
    certificadoPfxBase64,
    certificadoSenha,
    certificadoPresente: Boolean(certificadoPfxBase64),
    cnpjPrestador,
    inscricaoMunicipal: tenant?.inscricaoMunicipal?.trim() || undefined,
    municipioIbge,
    serieDps: (tenant?.serieDps?.replace(/\D/g, '') || '1').slice(0, 5),
    codigoTributacaoNacional: tenant?.codigoTributacaoNacional?.replace(/\D/g, '') || undefined,
    aliquotaIssPercent: numeroOu(tenant?.aliquotaIssPercent, 2),
    optanteSimplesNacional: numeroOu(tenant?.optanteSimplesNacional, 3),
    regimeEspecialTributacao: numeroOu(tenant?.regimeEspecialTributacao, 0),
  };
}

export function sanitizeTenantParametrosForClient<T extends Record<string, unknown>>(
  parametros: T,
): T {
  const { integracoesCredenciais: _creds, emailSmtp: _smtp, nfse, ...rest } = parametros as T & {
    integracoesCredenciais?: unknown;
    emailSmtp?: unknown;
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
