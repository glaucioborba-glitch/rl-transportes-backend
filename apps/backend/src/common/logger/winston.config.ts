import type { WinstonModuleOptions } from 'nest-winston';
import { ClsServiceManager } from 'nestjs-cls';
import * as winston from 'winston';
import { TRACE_ID_KEY } from '../observability/trace.constants';

function injectTraceIdFormat() {
  return winston.format((info) => {
    try {
      const cls = ClsServiceManager.getClsService();
      if (cls?.isActive()) {
        const traceId = cls.get<string>(TRACE_ID_KEY);
        if (traceId) info.traceId = traceId;
      }
    } catch {
      /* CLS indisponível fora de contexto HTTP/worker */
    }
    return info;
  })();
}

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  injectTraceIdFormat(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const winstonModuleOptions: WinstonModuleOptions = {
  transports: [
    new winston.transports.Console({
      format: jsonFormat,
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: jsonFormat,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: jsonFormat,
    }),
  ],
};
