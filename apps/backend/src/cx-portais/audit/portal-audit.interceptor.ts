import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import type { CxPortalRequestUser } from '../types/cx-portal.types';
import { PortalAuditService } from './portal-audit.service';
import { sanitizePortalAuditPayload } from './portal-audit-sanitize';

function isPortalCxRoute(urlPath: string): boolean {
  const p = urlPath.split('?')[0] ?? '';
  return p.startsWith('/portal') || p.startsWith('/cliente/portal');
}

function acaoFrom(method: string, path: string): string {
  const pl = path.replace(/\?.*$/, '');
  if (pl.includes('/portal/login')) return method === 'POST' ? 'portal_login' : 'portal_login_view';
  if (pl.includes('/portal/register')) return 'portal_cadastro';
  if (pl.includes('/portal/refresh')) return 'portal_refresh';
  if (pl.includes('/portal/esqueci-senha')) return 'portal_recuperacao_senha';
  if (pl.includes('/portal/redefinir-senha')) return 'portal_redefinir_senha';
  if (pl.includes('/cliente/portal/dashboard')) return 'dashboard_visualizacao';
  if (pl.includes('/cliente/portal/solicitacoes') && method === 'GET') return 'solicitacoes_listagem';
  if (pl.includes('/aprovar')) return 'solicitacao_aprovacao';
  if (pl.includes('/financeiro')) return 'financeiro_operacao';
  if (pl.includes('/nfse') || pl.includes('/boletos')) return 'documento_financeiro';
  return `${method.toLowerCase()}_${pl.slice(0, 80)}`;
}

@Injectable()
export class PortalAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: PortalAuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<
      Request & { cxUser?: CxPortalRequestUser; body?: unknown; query?: unknown; params?: unknown }
    >();
    const path = req.path ?? req.url ?? '';
    if (!isPortalCxRoute(path)) {
      return next.handle();
    }

    const method = req.method ?? 'GET';
    const cx = req.cxUser;
    const clienteId = cx?.clienteId ?? null;
    const usuarioPortalId = cx?.sub ?? null;

    const payloadRaw = {
      body: req.body,
      query: req.query,
      params: req.params,
    };

    return next.handle().pipe(
      tap((body: unknown) => {
        void this.audit.registrar({
          clienteId,
          usuarioPortalId,
          acao: acaoFrom(method, path),
          rota: path.slice(0, 512),
          metodoHttp: method,
          payloadEnviado: sanitizePortalAuditPayload(payloadRaw),
          resultado: { ok: true, response: body },
          ip: req.ip ?? 'unknown',
          userAgent: req.get('user-agent') ?? 'unknown',
        });
      }),
      catchError((err: unknown) => {
        const status = err instanceof HttpException ? err.getStatus() : 500;
        void this.audit.registrar({
          clienteId,
          usuarioPortalId,
          acao: acaoFrom(method, path),
          rota: path.slice(0, 512),
          metodoHttp: method,
          payloadEnviado: sanitizePortalAuditPayload(payloadRaw),
          resultado: {
            ok: false,
            status,
            message: err instanceof Error ? err.message.slice(0, 500) : 'error',
          },
          ip: req.ip ?? 'unknown',
          userAgent: req.get('user-agent') ?? 'unknown',
        });
        return throwError(() => err);
      }),
    );
  }
}
