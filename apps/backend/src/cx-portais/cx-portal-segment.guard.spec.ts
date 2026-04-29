import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { CxPortalSegmentGuard } from './guards/cx-portal-segment.guard';
import { CX_PORTAL_SEGMENT } from './decorators/cx-portal.decorators';

describe('CxPortalSegmentGuard', () => {
  let guard: CxPortalSegmentGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const m: TestingModule = await Test.createTestingModule({
      providers: [CxPortalSegmentGuard, Reflector],
    }).compile();
    guard = m.get(CxPortalSegmentGuard);
    reflector = m.get(Reflector);
  });

  function ctx(overrides: { cxUser?: unknown; segment?: 'cliente' | 'fornecedor' }): ExecutionContext {
    const req = { cxUser: overrides.cxUser };
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === CX_PORTAL_SEGMENT) return overrides.segment;
      return undefined;
    });
    const handler = function handler() {};
    const cls = function ctrl() {};
    return {
      getHandler: () => handler,
      getClass: () => cls,
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;
  }

  it('permite staff em rota cliente', () => {
    expect(
      guard.canActivate(
        ctx({
          segment: 'cliente',
          cxUser: { portalPapel: 'STAFF', sub: 'a', tenantId: 't' },
        }),
      ),
    ).toBe(true);
  });

  it('bloqueia fornecedor em rota cliente', () => {
    expect(() =>
      guard.canActivate(
        ctx({
          segment: 'cliente',
          cxUser: { portalPapel: 'FORNECEDOR', sub: 'x', tenantId: 't' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('permite CLIENTE em rota cliente', () => {
    expect(
      guard.canActivate(
        ctx({
          segment: 'cliente',
          cxUser: { portalPapel: 'CLIENTE', sub: 'x', tenantId: 't' },
        }),
      ),
    ).toBe(true);
  });
});
