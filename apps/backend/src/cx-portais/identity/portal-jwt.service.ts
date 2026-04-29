import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import type { PortalAccessTokenPayload, PortalRefreshTokenPayload } from '../types/cx-portal.types';

@Injectable()
export class PortalJwtService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  private portalSecret(): string {
    return (
      this.config.get<string>('PORTAL_JWT_SECRET') ??
      `${this.config.getOrThrow<string>('JWT_SECRET')}:portal`
    );
  }

  private portalRefreshSecret(): string {
    return (
      this.config.get<string>('PORTAL_JWT_REFRESH_SECRET') ??
      `${this.config.getOrThrow<string>('JWT_REFRESH_SECRET')}:portal`
    );
  }

  accessExpires(): StringValue {
    return (this.config.get<string>('PORTAL_JWT_EXPIRES_IN') ?? '1h') as StringValue;
  }

  refreshExpires(): StringValue {
    return (this.config.get<string>('PORTAL_JWT_REFRESH_EXPIRES_IN') ?? '7d') as StringValue;
  }

  signAccess(payload: Omit<PortalAccessTokenPayload, 'kind'>): string {
    const full: PortalAccessTokenPayload = { ...payload, kind: 'portal' };
    return this.jwt.sign(full, { secret: this.portalSecret(), expiresIn: this.accessExpires() });
  }

  signRefresh(payload: Omit<PortalRefreshTokenPayload, 'kind'>): string {
    const full: PortalRefreshTokenPayload = { ...payload, kind: 'portal_refresh' };
    return this.jwt.sign(full, {
      secret: this.portalRefreshSecret(),
      expiresIn: this.refreshExpires(),
    });
  }

  verifyAccess(token: string): PortalAccessTokenPayload {
    return this.jwt.verify<PortalAccessTokenPayload>(token, { secret: this.portalSecret() });
  }

  verifyRefresh(token: string): PortalRefreshTokenPayload {
    return this.jwt.verify<PortalRefreshTokenPayload>(token, { secret: this.portalRefreshSecret() });
  }

  /** Valida JWT corporativo (staff). */
  verifyStaffAccess(token: string): { sub: string; email: string; role: string; tv?: number } {
    const secret = this.config.get<string>('secrets.jwtSecret') ?? this.config.getOrThrow<string>('JWT_SECRET');
    return this.jwt.verify(token, { secret });
  }
}
