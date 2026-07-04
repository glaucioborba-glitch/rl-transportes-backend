import {
  assertJwtSecretForProduction,
  getCorsOrigins,
  getGlobalRateLimitTiers,
  isCsrfExemptPath,
  JWT_SECRET_MIN_LENGTH,
  JWT_SECRET_PLACEHOLDER,
} from './security.config';

describe('security.config — CORS portal auth', () => {
  const prev = process.env;

  beforeEach(() => {
    process.env = { ...prev };
    delete process.env.CORS_ORIGIN;
    delete process.env.CORS_ORIGIN_DEV;
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env = prev;
  });

  it('dev inclui localhost:3000 e :3001 para front e API local', () => {
    expect(getCorsOrigins()).toEqual(
      expect.arrayContaining([
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ]),
    );
  });

  it('/portal/auth/* isento de CSRF (bootstrap pós-login)', () => {
    expect(isCsrfExemptPath('/portal/auth/minhas-permissoes')).toBe(true);
    expect(isCsrfExemptPath('/portal/auth/pessoas')).toBe(true);
    expect(isCsrfExemptPath('/portal/auth/health')).toBe(true);
  });

  it('/auth/health isento de CSRF (heartbeat staff)', () => {
    expect(isCsrfExemptPath('/auth/health')).toBe(true);
  });
});

describe('security.config — rate limit tiers', () => {
  const prev = process.env;

  beforeEach(() => {
    process.env = { ...prev };
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_GET_MAX;
    delete process.env.RATE_LIMIT_WRITE_MAX;
    delete process.env.DEPLOY_ENV;
  });

  afterAll(() => {
    process.env = prev;
  });

  it('development: 100 req/min para GET e mutações', () => {
    process.env.NODE_ENV = 'development';
    const tiers = getGlobalRateLimitTiers();
    expect(tiers.read).toEqual({ windowMs: 60_000, max: 100 });
    expect(tiers.write).toEqual({ windowMs: 60_000, max: 100 });
  });

  it('production: GET mais permissivo, mutações mais restritas', () => {
    process.env.NODE_ENV = 'production';
    const tiers = getGlobalRateLimitTiers();
    expect(tiers.read).toEqual({ windowMs: 60_000, max: 50 });
    expect(tiers.write).toEqual({ windowMs: 60_000, max: 20 });
  });
});

describe('security.config — JWT boot guard (C-08)', () => {
  const prev = process.env;

  beforeEach(() => {
    process.env = { ...prev };
  });

  afterAll(() => {
    process.env = prev;
  });

  it('dev permite placeholder curto', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DEPLOY_ENV;
    process.env.JWT_SECRET = JWT_SECRET_PLACEHOLDER;
    expect(() => assertJwtSecretForProduction()).not.toThrow();
  });

  it('produção rejeita placeholder do .env.example', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = JWT_SECRET_PLACEHOLDER;
    expect(() => assertJwtSecretForProduction()).toThrow(/JWT_SECRET inválido/);
  });

  it('produção rejeita segredo com menos de 32 caracteres', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(JWT_SECRET_MIN_LENGTH - 1);
    expect(() => assertJwtSecretForProduction()).toThrow(/JWT_SECRET inválido/);
  });

  it('produção aceita segredo forte', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(JWT_SECRET_MIN_LENGTH);
    expect(() => assertJwtSecretForProduction()).not.toThrow();
  });
});
