import { ExecutionContext } from '@nestjs/common';

import { CxPortalRateLimitGuard } from './cx-portal-rate-limit.guard';

import { CxPortalRateLimitService } from '../security/cx-portal-rate-limit.service';



describe('CxPortalRateLimitGuard', () => {

  const limiter = { poke: jest.fn().mockResolvedValue(undefined) };

  const guard = new CxPortalRateLimitGuard(limiter as unknown as CxPortalRateLimitService);



  function ctx(url: string): ExecutionContext {

    return {

      switchToHttp: () => ({

        getRequest: () => ({ url, path: url }),

      }),

    } as ExecutionContext;

  }



  beforeEach(() => {

    limiter.poke.mockClear();

  });



  it('minhas-permissoes → bypass rate-limit (nunca aciona 429)', async () => {

    await expect(guard.canActivate(ctx('/portal/auth/minhas-permissoes'))).resolves.toBe(true);

    expect(limiter.poke).not.toHaveBeenCalled();

  });



  it('outras rotas portal → aplica limitador', async () => {

    await expect(guard.canActivate(ctx('/cliente/portal/kpis'))).resolves.toBe(true);

    expect(limiter.poke).toHaveBeenCalledTimes(1);

  });

});

