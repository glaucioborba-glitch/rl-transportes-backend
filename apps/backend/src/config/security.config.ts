import { registerAs } from '@nestjs/config';

export const JWT_SECRET_PLACEHOLDER = 'defina_um_segredo_longo';
export const JWT_SECRET_MIN_LENGTH = 32;

/** Ambiente de produção (NODE_ENV ou DEPLOY_ENV). */
export function isProductionDeploy(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    ['prod', 'production'].includes((process.env.DEPLOY_ENV || '').toLowerCase())
  );
}

/**
 * Impede boot em produção com JWT_SECRET ausente, placeholder ou curto demais.
 * @throws Error quando a validação falha
 */
export function assertJwtSecretForProduction(): void {
  if (!isProductionDeploy()) return;

  const secret = (process.env.JWT_SECRET ?? '').trim();
  if (!secret || secret === JWT_SECRET_PLACEHOLDER || secret.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(
      `JWT_SECRET inválido em produção: defina um segredo com no mínimo ${JWT_SECRET_MIN_LENGTH} caracteres (não use o placeholder do .env.example).`,
    );
  }
}

/** Origens CORS: CORS_ORIGIN tem prioridade; senão perfil por NODE_ENV / DEPLOY_ENV. */
export function getCorsOrigins(): string[] {
  const explicit = process.env.CORS_ORIGIN?.trim();
  if (explicit) {
    return explicit.split(',').map((o) => o.trim()).filter(Boolean);
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  const deploy = (process.env.DEPLOY_ENV || '').toLowerCase();

  if (nodeEnv === 'production' || deploy === 'prod' || deploy === 'production') {
    const prod = (process.env.CORS_ORIGIN_PROD || process.env.CORS_ORIGIN_PRD || '').trim();
    if (prod) return prod.split(',').map((o) => o.trim()).filter(Boolean);
  }

  if (['homolog', 'qa', 'staging', 'preprod', 'pré-prod'].includes(deploy)) {
    const qa = (
      process.env.CORS_ORIGIN_QA ||
      process.env.CORS_ORIGIN_HOMOLOG ||
      process.env.CORS_ORIGIN_STAGING ||
      ''
    ).trim();
    if (qa) return qa.split(',').map((o) => o.trim()).filter(Boolean);
  }

  const devCsv = process.env.CORS_ORIGIN_DEV?.trim();
  if (devCsv) {
    return devCsv.split(',').map((o) => o.trim()).filter(Boolean);
  }
  /** Em dev: front em localhost e 127.0.0.1 (credentials + cookies cruzados para API em outra porta). */
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

/** Swagger: desligado em produção salvo SWAGGER_ENABLED=1; em dev ativo salvo SWAGGER_ENABLED=0. */
export function isSwaggerEnabled(): boolean {
  return (
    process.env.SWAGGER_ENABLED === '1' ||
    (process.env.NODE_ENV !== 'production' && process.env.SWAGGER_ENABLED !== '0')
  );
}

/** Anti-CSRF double-submit; defina CSRF_ENABLED=1 em ambientes com front em navegador. */
export function isCsrfEnabled(): boolean {
  return process.env.CSRF_ENABLED === '1';
}

/**
 * Rotas que não exigem header CSRF (login, integrações máquina-máquina, mobile nativo, assets públicos).
 */
export function isCsrfExemptPath(path: string): boolean {
  const p = (path.split('?')[0] || path).replace(/\/$/, '') || '/';

  if (p === '/auth/login' || p === '/auth/refresh' || p === '/auth/health' || p === '/auth/register' || p === '/auth/reset-password')
    return true;
  if (
    p === '/portal/login' ||
    p === '/portal/refresh' ||
    p === '/portal/logout' ||
    p === '/portal/me' ||
    p === '/portal/2fa' ||
    p === '/portal/register' ||
    p === '/portal/esqueci-senha' ||
    p === '/portal/redefinir-senha'
  ) {
    return true;
  }
  if (p.startsWith('/portal/auth/')) return true;

  const prefixes = [
    '/health',
    '/public',
    '/marketplace',
    '/gateway',
    '/mobile',
    '/integracao',
    '/cliente-api',
  ];

  for (const pre of prefixes) {
    if (p === pre || p.startsWith(`${pre}/`)) return true;
  }

  return false;
}

/**
 * Rotas isentas de validação obrigatória de headers de dispositivo/sessão
 * (login, documentação, integrações máquina-máquine, health).
 */
export function isSecurityHeadersExemptPath(path: string): boolean {
  const p = (path.split('?')[0] || path).replace(/\/$/, '') || '/';

  if (p === '/health') return true;
  if (p.startsWith('/docs')) return true;

  if (
    p === '/auth/login' ||
    p === '/auth/refresh' ||
    p === '/auth/health' ||
    p === '/auth/register' ||
    p === '/auth/reset-password'
  ) {
    return true;
  }
  if (
    p === '/portal/login' ||
    p === '/portal/refresh' ||
    p === '/portal/logout' ||
    p === '/portal/me' ||
    p === '/portal/2fa' ||
    p === '/portal/register' ||
    p === '/portal/esqueci-senha' ||
    p === '/portal/redefinir-senha'
  ) {
    return true;
  }
  if (p.startsWith('/portal/auth/')) return true;

  const prefixes = ['/public', '/marketplace', '/gateway', '/integracao', '/cliente-api'];
  for (const pre of prefixes) {
    if (p === pre || p.startsWith(`${pre}/`)) return true;
  }

  if (p === '/mobile/v1/auth' || p.startsWith('/mobile/v1/auth/')) return true;

  return false;
}

/**
 * Exige conjunto completo de headers para Bearer/cookies quando true.
 * Default: produção = ligado; desenvolvimento = permissivo salvo SECURITY_HEADERS_ENFORCE=1.
 */
export function shouldEnforceSecurityHeaders(): boolean {
  if (process.env.SECURITY_HEADERS_ENFORCE === '1') return true;
  if (process.env.SECURITY_HEADERS_ENFORCE === '0') return false;
  return process.env.NODE_ENV === 'production';
}

export default registerAs('security', () => ({
  corsOrigins: getCorsOrigins(),
  csrfEnabled: isCsrfEnabled(),
  swaggerEnabled: isSwaggerEnabled(),
}));
