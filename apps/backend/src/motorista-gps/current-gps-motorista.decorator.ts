import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GPS_MOTORISTA_REQUEST_KEY } from './motorista-gps.guard';
import type { MotoristaGpsJwtPayload } from './motorista-gps.types';

export const CurrentGpsMotorista = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MotoristaGpsJwtPayload => {
    const req = ctx.switchToHttp().getRequest<Record<string, MotoristaGpsJwtPayload | undefined>>();
    const payload = req[GPS_MOTORISTA_REQUEST_KEY];
    if (!payload) {
      throw new Error('Motorista GPS não autenticado');
    }
    return payload;
  },
);
