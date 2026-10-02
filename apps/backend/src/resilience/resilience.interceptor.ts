import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import {
  catchError,
  concatMap,
  defer,
  EMPTY,
  from,
  mergeMap,
  Observable,
  of,
  throwError,
  timeout,
  TimeoutError,
} from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { ObservabilityBridgeService } from '../observability/observability-bridge.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { ResilienceMetricsService } from './resilience-metrics.service';
import { DEFAULT_CB_CONFIG } from './resilience.constants';
import { buildFallbackPayload } from './resilience-fallback.registry';
import { matchResilienceRule, shouldBypassResilience } from './resilience-path.util';

@Injectable()
export class ResilienceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ResilienceInterceptor.name);

  constructor(
    private readonly circuit: CircuitBreakerService,
    private readonly metrics: ResilienceMetricsService,
    private readonly bridge: ObservabilityBridgeService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    if (this.config.get<string>('RESILIENCE_ENABLED', '1') === '0') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const path = req.path ?? req.url?.split('?')[0] ?? '';

    if (shouldBypassResilience(path)) {
      return next.handle();
    }

    const rule = matchResilienceRule(path);
    if (!rule) {
      return next.handle();
    }

    const service = rule.service;
    const timeoutMs = rule.timeoutMs;

    return from(this.circuit.shouldShortCircuit(service)).pipe(
      mergeMap((gate) => {
        if (gate.block) {
          const retryAfter = Math.ceil((gate.retryAfterMs ?? DEFAULT_CB_CONFIG.cooldownMs) / 1);
          const payload = {
            status: 'circuit-open',
            retryAfter,
            data: buildFallbackPayload(service, path),
          };
          return defer(() => {
            if (!res.headersSent) {
              res.status(200).json(payload);
            }
            return EMPTY;
          });
        }

        return next.handle().pipe(
          timeout(timeoutMs),
          concatMap((body: unknown) => {
            void this.circuit.recordSuccess(service);
            return of(body);
          }),
          catchError((err: unknown) => {
            void this.circuit.recordFailure(service);
            if (!this.shouldDegradeWithFallback(err)) {
              return throwError(() => err);
            }
            void this.metrics.recordFallback(service, path);
            void this.logFallbackWarning(service, path, req.method);
            this.bridge.emit({
              type: 'FALLBACK_EVENT',
              payload: {
                service,
                path,
                timestamp: new Date().toISOString(),
              },
            });
            return of(buildFallbackPayload(service, path));
          }),
        );
      }),
    );
  }

  private shouldDegradeWithFallback(err: unknown): boolean {
    if (err instanceof TimeoutError) return true;
    if (err instanceof HttpException) {
      const s = err.getStatus();
      return s >= 500 || s === 408;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (/CHAOS_DB_SYNTHETIC|CHAOS_/i.test(msg)) return true;
    if (/timeout|Timeout/i.test(msg)) return true;
    return false;
  }

  private async logFallbackWarning(
    service: string,
    path: string,
    method: string,
  ): Promise<void> {
    try {
      await this.prisma.securityAlert.create({
        data: {
          tipo: 'RESILIENCE_FALLBACK',
          rota: path.slice(0, 512),
          metodo: method.slice(0, 16),
          contexto: {
            service,
            nivel: 'WARNING',
            motivo: 'fallback-controlado',
          },
        },
      });
    } catch (e) {
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(`fallback alert: ${(e as Error).message}`);
      }
    }
  }
}
