import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceService } from '../auth/session/device.service';

@Injectable()
export class LoginTelemetryService {
  private readonly logger = new Logger(LoginTelemetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly device: DeviceService,
  ) {}

  private fp(req?: Request): string | null {
    if (!req) return null;
    try {
      const ip = String(req.ip || req.socket?.remoteAddress || '');
      const ua = req.get('user-agent') || '';
      const hdr = this.device.extractHeaders(req);
      return this.device.computeFingerprint(ip, ua, hdr);
    } catch {
      return null;
    }
  }

  async record(params: {
    documento: string;
    userId?: string | null;
    sucesso: boolean;
    motivo?: string | null;
    req?: Request;
  }): Promise<void> {
    try {
      const ip = params.req ? String(params.req.ip || params.req.socket?.remoteAddress || '').slice(0, 64) : null;
      const ua = params.req?.get('user-agent')?.slice(0, 1024) ?? null;
      await this.prisma.loginAttempt.create({
        data: {
          documento: params.documento.slice(0, 14),
          userId: params.userId ?? undefined,
          sucesso: params.sucesso,
          ip,
          userAgent: ua,
          motivo: params.motivo?.slice(0, 255) ?? null,
          fingerprint: this.fp(params.req),
        },
      });
    } catch (e) {
      this.logger.warn(`login_attempt: ${(e as Error).message}`);
    }
  }
}
