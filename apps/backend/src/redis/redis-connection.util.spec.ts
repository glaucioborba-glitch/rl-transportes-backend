import { resolveIoredisTarget } from './redis-connection.util';

describe('resolveIoredisTarget', () => {
  it('injeta REDIS_PASSWORD na URL quando a URL não tem senha', () => {
    const t = resolveIoredisTarget({
      REDIS_URL: 'redis://redis:6379',
      REDIS_PASSWORD: 's3cret-redis-password-32chars!!',
    });
    expect(t.url).toContain('s3cret-redis-password-32chars');
    expect(t.url).toContain('redis:6379');
  });

  it('usa host/porta + senha sem URL', () => {
    const t = resolveIoredisTarget({
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: '6380',
      REDIS_PASSWORD: 'abc',
    });
    expect(t.url).toBeUndefined();
    expect(t.host).toBe('127.0.0.1');
    expect(t.port).toBe(6380);
    expect(t.password).toBe('abc');
  });
});
