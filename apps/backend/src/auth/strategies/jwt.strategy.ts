import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Role } from '@prisma/client';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AUTH_ACCESS_COOKIE } from '../auth-cookie.constants';
import { permissionsForRole } from '../../common/constants/role-permissions';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session/session.service';

export type JwtPayload = {
  sub: string;
  cpfCnpj: string;
  email: string;
  role: Role;
  /** Versão de revogação; deve coincidir com `users.tokenVersion`. */
  tv?: number;
  /** Tenant B2B SaaS — isolamento row-level. */
  tenantId?: string;
  /** Opcional: vínculo ao cliente (portal B2B). */
  clienteId?: string | null;
  /** Sessão Redis (staff); refresh inclui também `fp`. */
  sid?: string;
  fp?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly configService: ConfigService;
  private readonly prisma: PrismaService;
  private readonly sessionService: SessionService;

  constructor(
    configService: ConfigService,
    prisma: PrismaService,
    sessionService: SessionService,
  ) {
    const secret =
      configService.get<string>('secrets.jwtSecret') ??
      configService.getOrThrow<string>('JWT_SECRET');
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        /** 1) Cookie HttpOnly `rl_at` */
        (req: Request) => {
          if (process.env.AUTH_HTTP_ONLY_COOKIES !== '1') return null;
          const raw = (req as Request & { cookies?: Record<string, string> }).cookies?.[AUTH_ACCESS_COOKIE];
          return raw ?? null;
        },
        /** 2) Authorization Bearer */
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
    this.configService = configService;
    this.prisma = prisma;
    this.sessionService = sessionService;
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    const payloadTv = payload.tv ?? 0;
    if (user.tokenVersion !== payloadTv) {
      throw new UnauthorizedException('Sessão inválida ou encerrada (logout)');
    }
    if (payload.sid) {
      const s = await this.sessionService.getSession(payload.sub, payload.sid);
      if (!s) {
        throw new UnauthorizedException('Sessão inválida ou expirada');
      }
      if (await this.sessionService.isFingerprintBlocked(s.fingerprint)) {
        throw new UnauthorizedException('Dispositivo bloqueado');
      }
    }
    const datahubTiEmailCsv = this.configService.get<string>('DATAHUB_TI_EMAILS') ?? '';
    return {
      sub: payload.sub,
      id: payload.sub,
      email: payload.email,
      cpfCnpj: user.cpfCnpj,
      role: payload.role,
      tenantId: user.tenantId ?? payload.tenantId ?? 'default',
      permissions: permissionsForRole(payload.role, {
        email: payload.email,
        datahubTiEmailCsv,
      }),
      clienteId: user.clienteId ?? null,
      sid: payload.sid,
    };
  }
}
