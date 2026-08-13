import {
  assertJwtSecretForProduction,
  isProductionDeploy,
  JWT_SECRET_MIN_LENGTH,
  JWT_SECRET_PLACEHOLDER,
} from './security.config';

const PLACEHOLDER_SECRETS = new Set([
  JWT_SECRET_PLACEHOLDER,
  'defina_refresh_segredo_longo',
  'defina_portal_jwt_segredo_longo',
  'defina_mobile_jwt_segredo_longo',
]);

function assertSecret(name: string, value: string | undefined, minLen = 32): void {
  const v = (value ?? '').trim();
  if (!v || PLACEHOLDER_SECRETS.has(v) || v.length < minLen) {
    throw new Error(
      `${name} inválido em produção: defina um segredo com no mínimo ${minLen} caracteres.`,
    );
  }
}

/** Validação central de boot — fail-fast antes de NestFactory.create. */
export function assertProductionEnvBoot(): void {
  if (!isProductionDeploy()) return;

  assertJwtSecretForProduction();
  assertSecret('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET);
  assertSecret('PORTAL_JWT_SECRET', process.env.PORTAL_JWT_SECRET ?? process.env.JWT_SECRET);
  assertSecret('MOBILE_JWT_SECRET', process.env.MOBILE_JWT_SECRET ?? process.env.JWT_SECRET);

  if (!process.env.AWS_S3_BUCKET?.trim()) {
    throw new Error(
      'AWS_S3_BUCKET obrigatório em produção (fotos vistoria, anexos, gate photos).',
    );
  }

  const cors = (process.env.CORS_ORIGIN ?? process.env.CORS_ORIGIN_PROD ?? '').trim();
  if (!cors) {
    throw new Error(
      'CORS_ORIGIN ou CORS_ORIGIN_PROD obrigatório em produção (não use fallback localhost).',
    );
  }

  if (process.env.REDIS_OPTIONAL === '1') {
    throw new Error('REDIS_OPTIONAL=1 não permitido em produção. Use REDIS_OPTIONAL=0.');
  }

  if (process.env.CSRF_ENABLED === '0') {
    console.warn('[boot] CSRF desabilitado explicitamente em produção (CSRF_ENABLED=0).');
  }
}
