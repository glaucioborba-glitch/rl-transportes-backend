import type { SecurityRequestContext } from '../common/types/security-request-context';

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware global quando os headers de segurança são válidos. */
      securityContext?: SecurityRequestContext;
      /** Evita linha duplicada em `device_auditorias` quando o middleware já registrou. */
      deviceAuditLoggedByMiddleware?: boolean;
    }
  }
}

export {};
