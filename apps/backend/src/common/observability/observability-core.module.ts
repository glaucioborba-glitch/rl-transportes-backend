import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { AlertModule } from '../../alert/alert.module';
import { LoggingInterceptor } from './logging.interceptor';
import { SentryExceptionFilter } from './sentry-exception.filter';
import { TraceMiddleware } from './trace.middleware';

@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: false },
    }),
    AlertModule,
  ],
  providers: [
    TraceMiddleware,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: SentryExceptionFilter },
  ],
  exports: [TraceMiddleware, ClsModule],
})
export class ObservabilityCoreModule {}
