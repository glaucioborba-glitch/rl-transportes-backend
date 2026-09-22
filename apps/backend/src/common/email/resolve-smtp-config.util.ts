export type SmtpEnvSnapshot = {
  host?: string;
  port?: string;
  user?: string;
  pass?: string;
};

export type SmtpTenantSnapshot = {
  host?: string;
  porta?: number;
  usuario?: string;
  senha?: string;
};

export type ResolvedSmtpConfig = {
  /** 'tenant' = parâmetros operacionais do terminal; 'env' = .env do servidor. */
  origem: 'tenant' | 'env' | 'none';
  configurado: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

const PORTA_PADRAO = 587;

function parsePorta(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) return PORTA_PADRAO;
  return Math.min(65535, Math.max(1, Math.round(n)));
}

/**
 * SMTP do terminal tem prioridade sobre o .env. Só considera o tenant quando
 * o host estiver preenchido — sem host não há como enviar.
 */
export function resolveSmtpConfig(
  env: SmtpEnvSnapshot,
  tenant?: SmtpTenantSnapshot,
): ResolvedSmtpConfig {
  const tenantHost = tenant?.host?.trim() ?? '';
  if (tenantHost) {
    const port = parsePorta(tenant?.porta);
    return {
      origem: 'tenant',
      configurado: true,
      host: tenantHost,
      port,
      secure: port === 465,
      user: tenant?.usuario?.trim() ?? '',
      pass: tenant?.senha ?? '',
    };
  }

  const envHost = env.host?.trim() ?? '';
  const port = parsePorta(env.port);
  return {
    origem: envHost ? 'env' : 'none',
    configurado: Boolean(envHost),
    host: envHost,
    port,
    secure: port === 465,
    user: env.user?.trim() ?? '',
    pass: env.pass ?? '',
  };
}
