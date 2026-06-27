import { sanitizeRequestPayload } from './request-sanitize.util';

describe('sanitizeRequestPayload', () => {
  it('redact campos sensíveis', () => {
    const out = sanitizeRequestPayload({
      email: 'a@b.com',
      password: 'secret123',
      nested: { token: 'jwt' },
    }) as Record<string, unknown>;

    expect(out.email).toBe('a@b.com');
    expect(out.password).toBe('[redacted]');
    expect((out.nested as Record<string, unknown>).token).toBe('[redacted]');
  });
});
