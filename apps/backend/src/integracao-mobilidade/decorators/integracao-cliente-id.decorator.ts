import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IntegracaoClienteIdParam = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<{ integracaoClienteId?: string }>();
  return req.integracaoClienteId;
});
