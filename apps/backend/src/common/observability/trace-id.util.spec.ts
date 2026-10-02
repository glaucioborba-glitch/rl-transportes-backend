import type { Request } from 'express';
import { resolveTraceId } from './trace-id.util';

describe('resolveTraceId', () => {
  it('usa x-correlation-id quando presente', () => {
    const req = {
      headers: { 'x-correlation-id': 'corr-abc' },
    } as unknown as Request;
    expect(resolveTraceId(req)).toBe('corr-abc');
  });

  it('fallback para x-request-id', () => {
    const req = {
      headers: { 'x-request-id': 'req-xyz' },
    } as unknown as Request;
    expect(resolveTraceId(req)).toBe('req-xyz');
  });

  it('gera uuid quando header ausente', () => {
    const req = { headers: {} } as unknown as Request;
    const id = resolveTraceId(req);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
