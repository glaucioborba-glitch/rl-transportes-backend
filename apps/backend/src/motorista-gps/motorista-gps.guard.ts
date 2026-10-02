import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { MOTORISTA_GPS_JWT_TYP } from './motorista-gps.util';
import type { MotoristaGpsJwtPayload } from './motorista-gps.types';

export const GPS_MOTORISTA_REQUEST_KEY = 'gpsMotorista';

@Injectable()
export class MotoristaGpsGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { [GPS_MOTORISTA_REQUEST_KEY]?: MotoristaGpsJwtPayload }>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Sessão de localização ausente');
    const secret =
      this.config.get<string>('secrets.jwtSecret') ?? this.config.getOrThrow<string>('JWT_SECRET');
    try {
      const payload = await this.jwt.verifyAsync<MotoristaGpsJwtPayload>(token, { secret });
      if (payload?.typ !== MOTORISTA_GPS_JWT_TYP || !payload.sub || !payload.cpf || !payload.origem) {
        throw new UnauthorizedException('Sessão de localização inválida');
      }
      req[GPS_MOTORISTA_REQUEST_KEY] = payload;
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Sessão de localização expirada');
    }
  }
}
