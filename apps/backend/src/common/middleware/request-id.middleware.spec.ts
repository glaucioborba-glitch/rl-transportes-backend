import type { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from './request-id.middleware';

describe('requestIdMiddleware', () => {
  it('definie X-Request-ID e reutiliza cabeçalho de entrada', () => {
    const res = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;
    const req = {
      headers: { 'x-request-id': 'abc-123' },
    } as unknown as Request;
    requestIdMiddleware(req, res, next);
    expect((req as Request & { requestId: string }).requestId).toBe('abc-123');
    expect((res as Response & { setHeader: jest.Mock }).setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      'abc-123',
    );
    expect(next).toHaveBeenCalled();
  });

  it('gera uuid quando o cabeçalho vem vazio', () => {
    const res = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;
    const req = { headers: {} } as unknown as Request;
    requestIdMiddleware(req, res, next);
    expect((req as Request & { requestId: string }).requestId).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
  });
});
