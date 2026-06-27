import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, mergeMap, timer } from 'rxjs';
import { ChaosGateService } from './chaos-gate.service';

/** Latência sintética e bloqueio HTTP antes do stack Nest (DEV/QA). */
@Injectable()
export class ChaosInterceptor implements NestInterceptor {
  constructor(private readonly gate: ChaosGateService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    if (!this.gate.isChaosEnvironment()) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? req.url?.split('?')[0] ?? '';

    if (
      path.startsWith('/admin/chaos') ||
      path.startsWith('/health') ||
      path.startsWith('/docs') ||
      path.startsWith('/favicon')
    ) {
      return next.handle();
    }

    const block = this.gate.matchRouteBlock(path);
    if (block) {
      throw new HttpException(
        {
          status: 'chaos-block',
          message: 'Endpoint sabotado pelo Chaos Monkey RL (sintético).',
          path,
        },
        block.status,
      );
    }

    const extra = this.gate.extraLatencyForPath(path);
    if (extra <= 0) return next.handle();

    return timer(extra).pipe(mergeMap(() => next.handle()));
  }
}
