import { assertProductionEnvBoot } from './env-boot.validation';
import { JWT_SECRET_PLACEHOLDER } from './security.config';

describe('assertProductionEnvBoot', () => {
  const prev = process.env;

  beforeEach(() => {
    process.env = { ...prev };
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);
    process.env.PORTAL_JWT_SECRET = 'c'.repeat(32);
    process.env.MOBILE_JWT_SECRET = 'd'.repeat(32);
    process.env.AWS_S3_BUCKET = 'rl-transportes';
    process.env.CORS_ORIGIN = 'https://portal.example.com';
    process.env.INTEGRACAO_FINANCE_WEBHOOK_SECRET = 'e'.repeat(32);
    process.env.INTEGRACAO_INTERNO_SECRET = 'f'.repeat(32);
    process.env.STORAGE_SIGNING_SECRET = 'g'.repeat(32);
    process.env.REDIS_PASSWORD = 'h'.repeat(16);
    delete process.env.REDIS_OPTIONAL;
    delete process.env.CSRF_ENABLED;
  });

  afterAll(() => {
    process.env = prev;
  });

  it('não valida fora de produção', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    expect(() => assertProductionEnvBoot()).not.toThrow();
  });

  it('exige secrets de webhook e IoT em produção', () => {
    delete process.env.INTEGRACAO_FINANCE_WEBHOOK_SECRET;
    expect(() => assertProductionEnvBoot()).toThrow(/INTEGRACAO_FINANCE_WEBHOOK_SECRET/);
  });

  it('rejeita placeholder JWT', () => {
    process.env.JWT_SECRET = JWT_SECRET_PLACEHOLDER;
    expect(() => assertProductionEnvBoot()).toThrow(/JWT_SECRET/);
  });

  it('exige REDIS_PASSWORD em produção', () => {
    delete process.env.REDIS_PASSWORD;
    expect(() => assertProductionEnvBoot()).toThrow(/REDIS_PASSWORD/);
  });

  it('passa com secrets mínimos válidos', () => {
    expect(() => assertProductionEnvBoot()).not.toThrow();
  });
});
