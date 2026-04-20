import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import type { AuthUser } from '../decorators/current-user.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  const ctx = (user: AuthUser | undefined) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as any;

  const user = (role: Role): AuthUser => ({
    sub: 'u1',
    id: 'u1',
    email: 'a@a.com',
    role,
    permissions: [],
  });

  it('permite quando não há papéis exigidos', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(ctx(user(Role.CLIENTE)))).toBe(true);
  });

  it('permite quando o papel do usuário está na lista', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ADMIN, Role.GERENTE]);
    expect(guard.canActivate(ctx(user(Role.GERENTE)))).toBe(true);
  });

  it('nega quando o papel não está na lista', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ADMIN]);
    expect(guard.canActivate(ctx(user(Role.CLIENTE)))).toBe(false);
  });
});
