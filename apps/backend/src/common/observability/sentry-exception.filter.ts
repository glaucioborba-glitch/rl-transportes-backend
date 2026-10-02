import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { ClsService } from 'nestjs-cls';
import type { Request } from 'express';
import { sanitizeRequestPayload } from './request-sanitize.util';
import { TRACE_ID_KEY } from './trace.constants';
import type { TraceAwareRequest } from './trace.middleware';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly cls: ClsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<TraceAwareRequest>();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const traceId =
      this.cls.get<string>(TRACE_ID_KEY) ?? request.traceId ?? request.requestId ?? 'unknown';

    const isUnhandled =
      !(exception instanceof HttpException) || status >= HttpStatus.INTERNAL_SERVER_ERROR;

    if (isUnhandled) {
      Sentry.withScope((scope) => {
        scope.setTag('traceId', traceId);
        scope.setTag('http.method', request.method);
        scope.setTag('http.route', request.originalUrl ?? request.url);
        scope.setExtra('requestBody', sanitizeRequestPayload(request.body));
        scope.setExtra('query', sanitizeRequestPayload(request.query));
        Sentry.captureException(exception);
      });
      this.logger.error(
        `[${traceId}] ${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    if (response.headersSent) {
      this.logger.warn(
        `[${traceId}] ${request.method} ${request.url} → ${status} (resposta já enviada; ignorando reply duplicado)`,
      );
      return;
    }

    const responseBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            statusCode: status,
            message: 'Internal server error',
            traceId,
          };

    if (typeof responseBody === 'object' && responseBody !== null && !('traceId' in responseBody)) {
      (responseBody as Record<string, unknown>).traceId = traceId;
    }

    httpAdapter.reply(response, responseBody, status);
  }
}
