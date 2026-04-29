import { registerAs } from '@nestjs/config';

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

  const dev = (process.env.CORS_ORIGIN_DEV || 'http://localhost:3001').trim();
  return dev ? [dev] : ['http://localhost:3001'];
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

  if (p === '/auth/login' || p === '/auth/refresh') return true;
  if (p === '/portal/login' || p === '/portal/refresh' || p === '/portal/2fa') return true;

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

export default registerAs('security', () => ({
  corsOrigins: getCorsOrigins(),
  csrfEnabled: isCsrfEnabled(),
  swaggerEnabled: isSwaggerEnabled(),
}));
