import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import type { MobileAccessPayload, MobileRefreshPayload } from '../types/mobile-hub.types';

@Injectable()
export class MobileJwtService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  private secret() {
    return (
      this.config.get<string>('MOBILE_JWT_SECRET') ??
      `${this.config.getOrThrow<string>('JWT_SECRET')}:mobile`
    );
  }

  private refreshSecret() {
    return (
      this.config.get<string>('MOBILE_JWT_REFRESH_SECRET') ??
      `${this.config.getOrThrow<string>('JWT_REFRESH_SECRET')}:mobile`
    );
  }

  accessTtl(): StringValue {
    return (this.config.get<string>('MOBILE_JWT_EXPIRES_IN') ?? '45m') as StringValue;
  }

  refreshTtl(): StringValue {
    return (this.config.get<string>('MOBILE_JWT_REFRESH_EXPIRES_IN') ?? '30d') as StringValue;
  }

  signAccess(p: Omit<MobileAccessPayload, 'kind'>): string {
    return this.jwt.sign({ ...p, kind: 'mobile_access' } satisfies MobileAccessPayload, {
      secret: this.secret(),
      expiresIn: this.accessTtl(),
    });
  }

  signRefresh(p: Omit<MobileRefreshPayload, 'kind'>): string {
    return this.jwt.sign({ ...p, kind: 'mobile_refresh' } satisfies MobileRefreshPayload, {
      secret: this.refreshSecret(),
      expiresIn: this.refreshTtl(),
    });
  }

  verifyAccess(token: string): MobileAccessPayload {
    return this.jwt.verify<MobileAccessPayload>(token, { secret: this.secret() });
  }

  verifyRefresh(token: string): MobileRefreshPayload {
    return this.jwt.verify<MobileRefreshPayload>(token, { secret: this.refreshSecret() });
  }

  verifyStaff(token: string): { sub: string; role: string; tv?: number } {
    const s = this.config.get<string>('secrets.jwtSecret') ?? this.config.getOrThrow<string>('JWT_SECRET');
    return this.jwt.verify(token, { secret: s });
  }
}
