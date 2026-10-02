import { extractRequestIp } from './request-ip.util';

type ReqLike = Parameters<typeof extractRequestIp>[0];

describe('extractRequestIp', () => {
  it('prioriza x-forwarded-for', () => {
    const ip = extractRequestIp({
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '::ffff:127.0.0.1' },
    } as unknown as ReqLike);
    expect(ip).toBe('203.0.113.1');
  });

  it('usa req.ip quando não há proxy', () => {
    const ip = extractRequestIp({
      headers: {},
      ip: '192.168.1.10',
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as ReqLike);
    expect(ip).toBe('192.168.1.10');
  });

  it('normaliza ipv6 mapeado', () => {
    const ip = extractRequestIp({
      headers: {},
      socket: { remoteAddress: '::ffff:10.0.0.5' },
    } as unknown as ReqLike);
    expect(ip).toBe('10.0.0.5');
  });
});
