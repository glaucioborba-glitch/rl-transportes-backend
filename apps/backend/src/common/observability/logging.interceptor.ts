import {

  CallHandler,

  ExecutionContext,

  Inject,

  Injectable,

  LoggerService,

  NestInterceptor,

  Optional,

} from '@nestjs/common';

import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import * as Sentry from '@sentry/node';

import { ClsService } from 'nestjs-cls';

import type { Request, Response } from 'express';

import { Observable, tap } from 'rxjs';

import { AlertService } from '../../alert/alert.service';

import { TRACE_ID_KEY } from './trace.constants';



const SLOW_MS = 500;

const GATE_QR_SLOW_MS = 2000;



@Injectable()

export class LoggingInterceptor implements NestInterceptor {

  constructor(

    @Inject(WINSTON_MODULE_NEST_PROVIDER)

    private readonly logger: LoggerService,

    private readonly cls: ClsService,

    @Optional() private readonly alerts?: AlertService,

  ) {}



  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {

    if (context.getType() !== 'http') {

      return next.handle();

    }



    const req = context.switchToHttp().getRequest<Request>();

    const res = context.switchToHttp().getResponse<Response>();

    const method = req.method;

    const url = req.originalUrl ?? req.url;

    const started = Date.now();

    const isGateQr = url.includes('/gate/validar-qr');



    this.logger.log(`Request Started ${method} ${url}`);



    return next.handle().pipe(

      tap({

        next: () => this.logCompleted(method, url, res.statusCode, started, isGateQr),

        error: () => this.logCompleted(method, url, res.statusCode || 500, started, isGateQr, true),

      }),

    );

  }



  private logCompleted(

    method: string,

    url: string,

    statusCode: number,

    started: number,

    isGateQr: boolean,

    errored = false,

  ): void {

    const ms = Date.now() - started;

    const slowThreshold = isGateQr ? GATE_QR_SLOW_MS : SLOW_MS;

    const msg = `Request Completed ${method} ${url} ${statusCode} - ${ms}ms`;

    const traceId = this.cls.get<string>(TRACE_ID_KEY);



    if (ms > slowThreshold || errored) {

      this.logger.warn(msg);

    } else {

      this.logger.log(msg);

    }



    if (isGateQr && ms > GATE_QR_SLOW_MS) {

      Sentry.withScope((scope) => {

        scope.setTag('traceId', traceId ?? 'unknown');

        scope.setTag('http.route', url);

        scope.setExtra('gate_qr_latency_ms', ms);

        Sentry.captureMessage(`Gate validar-qr lento: ${ms}ms`, 'warning');

      });

      void this.alerts?.gateQrSlow({ ms, url, traceId });

    }

  }

}


