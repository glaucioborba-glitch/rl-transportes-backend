import type { NextFunction, Request, Response } from 'express';
import { validarCSRFToken } from '../security/csrftoken.util';
import { CSRF_COOKIE_NAME } from '../../auth/csrf.constants';
import { attachCsrfCookie } from '../../auth/csrf-cookie.util';
import { gerarCSRFToken } from '../security/csrftoken.util';
import { isCsrfEnabled, isCsrfExemptPath } from '../../config/security.config';

function requestPath(req: Request): string {
  return (req as Request & { path?: string }).path || req.url?.split('?')[0] || '';
}

function isStateChanging(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

/**
 * Double-submit CSRF: cookie não-httpOnly + header X-CSRF-Token em métodos mutáveis.
 * Desligado por padrão (CSRF_ENABLED≠1) para não impactar integrações existentes.
 */
export function csrfProtectionMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isCsrfEnabled()) {
      next();
      return;
    }

    const path = requestPath(req);

    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    if (['GET', 'HEAD'].includes(req.method)) {
      const existing = req.cookies?.[CSRF_COOKIE_NAME];
      if (!existing || existing.length < 16) {
        attachCsrfCookie(res, gerarCSRFToken());
      }
      next();
      return;
    }

    if (isStateChanging(req.method)) {
      if (isCsrfExemptPath(path)) {
        next();
        return;
      }
      const cookieVal = req.cookies?.[CSRF_COOKIE_NAME];
      const headerVal = req.headers['x-csrf-token'];
      if (!validarCSRFToken(cookieVal, headerVal)) {
        res.status(403).json({
          statusCode: 403,
          message: 'CSRF token inválido ou ausente',
        });
        return;
      }
    }

    next();
  };
}
