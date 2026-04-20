import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PermissionsGuard } from './permissions.guard';
import type { AuthUser } from '../decorators/current-user.decorator';
describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new PermissionsGuard(reflector as unknown as Reflector);

  const ctx = (user: AuthUser | undefined) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as any;

  it('permite quando não há permissões exigidas', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(ctx(undefined))).toBe(true);
  });

  it('ADMIN passa sempre', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['clientes:excluir']);
    const user: AuthUser = {
      sub: '1',
      id: '1',
      email: 'a@a.com',
      role: Role.ADMIN,
      permissions: [],
    };
    expect(guard.canActivate(ctx(user))).toBe(true);
  });

  it('nega sem permissão', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['clientes:excluir']);
    const user: AuthUser = {
      sub: '1',
      id: '1',
      email: 'a@a.com',
      role: Role.OPERADOR_PATIO,
      permissions: ['clientes:ler'],
    };
    expect(() => guard.canActivate(ctx(user))).toThrow();
  });
});
