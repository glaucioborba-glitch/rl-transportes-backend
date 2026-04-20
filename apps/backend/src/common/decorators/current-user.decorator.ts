import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';

export type AuthUser = {
  sub: string;
  id: string;
  email: string;
  role: Role;
  /** Derivado do papel (RBAC granular). */
  permissions: string[];
};

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | string | string[] | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;
    if (!user) return undefined;
    if (data === undefined) return user;
    return user[data];
  },
);
