import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import type { User } from '@prisma/client';
import { AcaoAuditoria } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { permissionsForRole } from '../common/constants/role-permissions';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PrismaService } from '../prisma/prisma.service';
import { PRISMA_SERIALIZABLE_TX } from '../prisma/transaction-options';
import { PasswordPolicyService } from '../common/security/password-policy.service';
import { RedisService } from '../redis/redis.service';
import type { JwtPayload } from './strategies/jwt.strategy';
import { CreateUserDto } from './dto/create-user.dto';
import { normalizeLoginDocumento, sanitizeDocumentoInput } from '../common/utils/login-documento.util';
import { SessionService } from './session/session.service';
import { DeviceService } from './session/device.service';
import { parseDurationToSeconds } from './session/session.util';
import { LoginTelemetryService } from '../security-center/login-telemetry.service';
import { DEFAULT_TENANT_ID } from '../tenant/tenant.constants';
import { userWhereByDocumento, userWhereByEmail } from '../tenant/tenant-prisma.util';
import type { Request } from 'express';

const BCRYPT_ROUNDS = 12;
const BRUTE_FORCE_MAX_ATTEMPTS = 5;
const BRUTE_FORCE_LOCK_SECONDS = 900;
const BRUTE_FORCE_MSG =
  'Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em 15 minutos.';

function bruteForceLoginKey(tenantId: string, cpfCnpj: string): string {
  return `brute_force:login:${tenantId}:${cpfCnpj}`;
}

function activeSessionKey(userId: string): string {
  return `session:active:${userId}`;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly auditoria: AuditoriaService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly sessionService: SessionService,
    private readonly deviceService: DeviceService,
    private readonly loginTelemetry: LoginTelemetryService,
  ) {}

  async validateUser(tenantId: string, cpfCnpj: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: userWhereByDocumento(tenantId, cpfCnpj),
    });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.password);
    return ok ? user : null;
  }

  /** Sanitiza e alinha ao formato `User.cpfCnpj` (14 dígitos) para lookup. */
  private resolveLoginDocumento(documento: string): string {
    const sanitized = sanitizeDocumentoInput(documento);
    if (sanitized.length === 14) return sanitized;
    if (sanitized.length === 11) return sanitized.padStart(14, '0');
    if (sanitized.length === 10) return sanitized.padStart(11, '0').padStart(14, '0');
    return sanitized;
  }

  private async assertBruteForceNotLocked(tenantId: string, cpfCnpj: string): Promise<void> {
    const key = bruteForceLoginKey(tenantId, cpfCnpj);
    try {
      const raw = await this.redisService.get(key);
      if (raw != null && parseInt(raw, 10) >= BRUTE_FORCE_MAX_ATTEMPTS) {
        throw new UnauthorizedException(BRUTE_FORCE_MSG);
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      this.logger.warn(
        `Redis indisponível ao checar brute-force; prosseguindo: ${(e as Error).message}`,
      );
    }
  }

  private async recordBruteForceFailure(tenantId: string, cpfCnpj: string): Promise<never> {
    const key = bruteForceLoginKey(tenantId, cpfCnpj);
    try {
      const attempts = await this.redisService.incr(key);
      if (attempts >= BRUTE_FORCE_MAX_ATTEMPTS) {
        await this.redisService.expire(key, BRUTE_FORCE_LOCK_SECONDS);
        throw new UnauthorizedException(BRUTE_FORCE_MSG);
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      this.logger.warn(`Redis brute-force incr falhou: ${(e as Error).message}`);
    }
    throw new UnauthorizedException('Credenciais inválidas');
  }

  private async clearBruteForceCounter(tenantId: string, cpfCnpj: string): Promise<void> {
    try {
      await this.redisService.del(bruteForceLoginKey(tenantId, cpfCnpj));
    } catch (e) {
      this.logger.warn(`Redis del brute-force ignorado: ${(e as Error).message}`);
    }
  }

  private async revokePriorActiveSession(userId: string, ttlSec: number): Promise<void> {
    const key = activeSessionKey(userId);
    try {
      const prevSessionId = await this.redisService.get(key);
      if (prevSessionId?.trim()) {
        await this.sessionService.removeSession(userId, prevSessionId.trim(), ttlSec);
      }
    } catch (e) {
      this.logger.warn(`Revogação de sessão anterior ignorada: ${(e as Error).message}`);
    }
  }

  private async bindActiveSession(
    userId: string,
    sessionId: string,
    ttlSec: number,
  ): Promise<void> {
    try {
      await this.redisService.setex(activeSessionKey(userId), ttlSec, sessionId);
    } catch (e) {
      this.logger.warn(`Redis session:active não gravado: ${(e as Error).message}`);
    }
  }

  async login(
    tenantId: string,
    documento: string,
    password: string,
    audit?: { ip?: string; userAgent?: string },
    req?: Request,
  ) {
    const normalized = this.resolveLoginDocumento(documento);
    const tenant = tenantId.trim() || DEFAULT_TENANT_ID;
    await this.assertBruteForceNotLocked(tenant, normalized);

    const user = await this.validateUser(tenant, normalized, password);
    if (!user) {
      await this.loginTelemetry.record({
        documento: normalized,
        sucesso: false,
        motivo: 'Credenciais inválidas',
        req,
      });
      return this.recordBruteForceFailure(tenant, normalized);
    }

    await this.clearBruteForceCounter(tenant, normalized);

    const refreshExp = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const ttlSec = parseDurationToSeconds(refreshExp);

    let sessionBundle:
      | { sessionId: string; fingerprint: string; ttlSec: number }
      | undefined;
    if (req) {
      try {
        const ip = String(req.ip || req.socket?.remoteAddress || '');
        const ua = req.get('user-agent') || '';
        const hdr = this.deviceService.extractHeaders(req);
        const fp = this.deviceService.computeFingerprint(ip, ua, hdr);
        await this.revokePriorActiveSession(user.id, ttlSec);
        const { sessionId } = await this.sessionService.registerSession(
          user.id,
          {
            fingerprint: fp,
            ip,
            userAgent: ua,
            channel: 'staff',
          },
          ttlSec,
        );
        await this.bindActiveSession(user.id, sessionId, ttlSec);
        sessionBundle = { sessionId, fingerprint: fp, ttlSec };
      } catch (e) {
        this.logger.warn(`Sessão Redis (staff) não registrada: ${(e as Error).message}`);
      }
    }
    const tokens = this.issueTokens(user, sessionBundle);

    try {
      await this.auditoria.registrar({
        tabela: 'auth',
        registroId: user.id,
        acao: AcaoAuditoria.INSERT,
        usuario: user.id,
        dadosDepois: {
          event: 'LOGIN_SUCCESS',
          cpfCnpj: user.cpfCnpj,
          clienteId: user.clienteId ?? null,
        },
        ip: audit?.ip,
        userAgent: audit?.userAgent,
      });
    } catch (e) {
      this.logger.warn(`Auditoria de login não registrada: ${(e as Error).message}`);
    }

    try {
      await this.loginTelemetry.record({
        documento: normalized,
        userId: user.id,
        sucesso: true,
        req,
      });
    } catch (e) {
      this.logger.warn(`Telemetria login: ${(e as Error).message}`);
    }

    return tokens;
  }

  /**
   * Heartbeat de sessão staff: valida JWT do cookie HttpOnly e renova silenciosamente
   * quando o tempo restante de vida cair abaixo de 30%.
   */
  async sessionHealth(
    accessToken: string,
    req?: Request,
  ): Promise<{ ok: true; renewed: boolean; accessToken?: string }> {
    let payload: JwtPayload & { exp?: number; iat?: number };
    try {
      payload = this.jwtService.verify<JwtPayload & { exp?: number; iat?: number }>(accessToken);
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    const payloadTv = payload.tv ?? 0;
    if (user.tokenVersion !== payloadTv) {
      throw new UnauthorizedException('Sessão revogada. Faça login novamente.');
    }

    const refreshExp = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const ttlSec = parseDurationToSeconds(refreshExp);

    if (payload.sid) {
      const s = await this.sessionService.getSession(payload.sub, payload.sid);
      if (!s) {
        throw new UnauthorizedException('Sessão inválida ou expirada');
      }
      if (await this.sessionService.isFingerprintBlocked(s.fingerprint)) {
        throw new UnauthorizedException('Dispositivo bloqueado');
      }
    }

    const exp = payload.exp;
    const iat = payload.iat;
    if (typeof exp !== 'number' || typeof iat !== 'number' || exp <= iat) {
      return { ok: true, renewed: false };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const remainingRatio = (exp - nowSec) / (exp - iat);

    if (remainingRatio >= 0.3) {
      if (payload.sid) {
        await this.sessionService.touchSession(payload.sub, payload.sid, ttlSec);
      }
      return { ok: true, renewed: false };
    }

    let sessionBundle: { sessionId: string; fingerprint: string; ttlSec: number } | undefined;
    if (payload.sid) {
      const ip = String(req?.ip || req?.socket?.remoteAddress || '');
      const ua = req?.get('user-agent') || '';
      const hdr = req ? this.deviceService.extractHeaders(req) : {};
      const fpNow = this.deviceService.computeFingerprint(ip, ua, hdr);
      const ok = await this.sessionService.assertSessionValid(
        user.id,
        payload.sid,
        fpNow,
        ttlSec,
      );
      if (!ok) {
        throw new UnauthorizedException('Sessão inválida ou expirada');
      }
      sessionBundle = { sessionId: payload.sid, fingerprint: fpNow, ttlSec };
    }

    const tokens = this.issueTokens(user, sessionBundle);
    return { ok: true, renewed: true, accessToken: tokens.accessToken };
  }

  async refresh(refreshToken: string, req?: Request) {
    const secret =
      this.configService.get<string>('secrets.jwtRefreshSecret') ??
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    const payloadTv = payload.tv ?? 0;
    if (user.tokenVersion !== payloadTv) {
      throw new UnauthorizedException('Sessão revogada. Faça login novamente.');
    }

    const refreshExp = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const ttlSec = parseDurationToSeconds(refreshExp);

    if (payload.sid && payload.fp !== undefined) {
      const ip = String(req?.ip || req?.socket?.remoteAddress || '');
      const ua = req?.get('user-agent') || '';
      const hdr = req ? this.deviceService.extractHeaders(req) : {};
      const fpNow = this.deviceService.computeFingerprint(ip, ua, hdr);
      if (fpNow !== payload.fp) {
        throw new UnauthorizedException('Fingerprint não coincide com a sessão');
      }
      const ok = await this.sessionService.assertSessionValid(
        user.id,
        payload.sid,
        fpNow,
        ttlSec,
      );
      if (!ok) {
        throw new UnauthorizedException('Sessão inválida ou expirada');
      }
      return this.issueTokens(user, {
        sessionId: payload.sid,
        fingerprint: fpNow,
        ttlSec,
      });
    }

    return this.issueTokens(user);
  }

  issueTokens(
    user: User,
    session?: { sessionId: string; fingerprint: string; ttlSec: number },
  ) {
    const base: JwtPayload = {
      sub: user.id,
      cpfCnpj: user.cpfCnpj,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion,
      tenantId: user.tenantId,
      clienteId: user.clienteId ?? null,
    };
    const accessPayload: JwtPayload = session
      ? { ...base, sid: session.sessionId }
      : base;
    const refreshPayload: JwtPayload = session
      ? { ...base, sid: session.sessionId, fp: session.fingerprint }
      : base;
    const accessExpires = this.configService.get<string>('JWT_EXPIRES_IN') ?? '1h';
    const refreshExpires = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const refreshSecret =
      this.configService.get<string>('secrets.jwtRefreshSecret') ??
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    const accessOpts: JwtSignOptions = { expiresIn: accessExpires as StringValue };
    const refreshOpts: JwtSignOptions = {
      secret: refreshSecret,
      expiresIn: refreshExpires as StringValue,
    };

    const datahubTiEmailCsv = this.configService.get<string>('DATAHUB_TI_EMAILS') ?? '';
    return {
      accessToken: this.jwtService.sign(accessPayload, accessOpts),
      refreshToken: this.jwtService.sign(refreshPayload, refreshOpts),
      user: {
        id: user.id,
        cpfCnpj: user.cpfCnpj,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        permissions: permissionsForRole(user.role, {
          email: user.email,
          datahubTiEmailCsv,
        }),
        clienteId: user.clienteId ?? null,
        createdAt: user.createdAt,
      },
    };
  }

  async logout(
    userId: string,
    opts?: { sessionId?: string; ip?: string; userAgent?: string },
  ) {
    const sessionId = opts?.sessionId;
    const ip = opts?.ip;
    const userAgent = opts?.userAgent;

    if (sessionId) {
      const ttl = parseDurationToSeconds(
        this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      );
      await this.sessionService.removeSession(userId, sessionId, ttl);
      try {
        await this.auditoria.registrar({
          tabela: 'auth',
          registroId: userId,
          acao: AcaoAuditoria.SEGURANCA,
          usuario: userId,
          dadosDepois: {
            event: 'LOGOUT_SESSION',
            sessionId,
            at: new Date().toISOString(),
          },
          ip,
          userAgent,
        });
      } catch (e) {
        this.logger.warn(`Auditoria logout sessão: ${(e as Error).message}`);
      }
      return;
    }

    await this.prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { tokenVersion: { increment: 1 } },
        });
        await this.auditoria.registrar(
          {
            tabela: 'auth',
            registroId: userId,
            acao: AcaoAuditoria.INSERT,
            usuario: userId,
            dadosDepois: { event: 'LOGOUT', at: new Date().toISOString() },
            ip,
            userAgent,
          },
          tx,
        );
      },
      PRISMA_SERIALIZABLE_TX,
    );
  }

  /** Lista sessões Redis ativas (staff) — formato enriquecido para UI. */
  async listActiveSessions(userId: string) {
    return this.sessionService.getActiveSessions(userId);
  }

  /** Encerra uma sessão específica do próprio usuário. */
  async revokeOwnSession(userId: string, sessionId: string): Promise<void> {
    const ttl = parseDurationToSeconds(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
    await this.sessionService.assertSessionOwnedAndRemove(userId, sessionId, ttl);
  }

  async createUser(
    dto: CreateUserDto,
    usuarioId: string,
    ip: string,
    userAgent: string,
  ) {
    const email = dto.email.toLowerCase();
    let cpfCnpj: string;
    try {
      cpfCnpj = normalizeLoginDocumento(dto.cpfCnpj);
    } catch {
      throw new ConflictException('Documento inválido');
    }
    const existsDoc = await this.prisma.user.findUnique({
      where: userWhereByDocumento(DEFAULT_TENANT_ID, cpfCnpj),
    });
    if (existsDoc) {
      throw new ConflictException('CPF/CNPJ já cadastrado');
    }
    const exists = await this.prisma.user.findUnique({
      where: userWhereByEmail(DEFAULT_TENANT_ID, email),
    });
    if (exists) {
      throw new ConflictException('E-mail já cadastrado');
    }
    this.passwordPolicy.assertStrong(dto.password);
    const password = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.user.create({
          data: {
            tenantId: DEFAULT_TENANT_ID,
            cpfCnpj,
            email,
            password,
            role: dto.role,
          },
        });
        await this.auditoria.registrar(
          {
            tabela: 'users',
            registroId: created.id,
            acao: AcaoAuditoria.INSERT,
            usuario: usuarioId,
            dadosAntes: null,
            dadosDepois: {
              id: created.id,
              cpfCnpj: created.cpfCnpj,
              email: created.email,
              role: created.role,
              tokenVersion: created.tokenVersion,
              clienteId: created.clienteId,
              createdAt: created.createdAt,
            },
            ip,
            userAgent,
          },
          tx,
        );
        return created;
      },
      PRISMA_SERIALIZABLE_TX,
    );
    const { password: _p, ...safe } = user;
    return safe;
  }
}
