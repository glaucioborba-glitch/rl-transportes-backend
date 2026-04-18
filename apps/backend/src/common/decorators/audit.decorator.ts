import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuditContext {
  /** Identificador do usuário (JWT sub / id). */
  usuario: string;
  ip: string;
  userAgent: string;
}

export const Audit = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuditContext => {
  const req = ctx.switchToHttp().getRequest<{
    user?: { id?: string };
    ip?: string;
    socket?: { remoteAddress?: string };
    headers?: Record<string, string | string[] | undefined>;
  }>();
  const id = req.user?.id ? String(req.user.id) : '';
  const ua = req.headers?.['user-agent'];
  return {
    usuario: id,
    ip: typeof req.ip === 'string' ? req.ip : req.socket?.remoteAddress ?? '',
    userAgent: Array.isArray(ua) ? ua[0] ?? '' : ua ?? '',
  };
});
