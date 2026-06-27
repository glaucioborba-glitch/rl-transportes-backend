import {
  Body,
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SessionService } from '../auth/session/session.service';
import { parseDurationToSeconds } from '../auth/session/session.util';
import { ConfigService } from '@nestjs/config';
import { SecurityAnalyticsService } from './security-analytics.service';

class DerrubarSessaoDto {
  @IsString()
  @MinLength(10)
  userId!: string;

  @IsString()
  @MinLength(10)
  sessionId!: string;
}

class BloquearDispositivoDto {
  @IsString()
  @MinLength(16)
  fingerprint!: string;
}

class SecurityAcaoDto {
  @IsIn(['bloquear_dispositivo', 'expulsar_sessao', 'desbloqueio_manual'])
  tipo!: 'bloquear_dispositivo' | 'expulsar_sessao' | 'desbloqueio_manual';

  @IsOptional()
  @IsString()
  @MinLength(16)
  fingerprint?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  userId?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  sessionId?: string;
}

@ApiTags('admin-security')
@ApiBearerAuth('access-token')
@Controller('admin/security')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class SecurityAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sessions: SessionService,
    private readonly analytics: SecurityAnalyticsService,
    private readonly config: ConfigService,
  ) {}

  @Get('sessoes')
  @ApiOperation({ summary: 'Todas as sessões Redis (visão global)' })
  async todasSessoes() {
    const keys = await this.redis.scanMatch('sess:*:*');
    const ttlHint = parseDurationToSeconds(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
    const portalTtl = parseDurationToSeconds(
      this.config.get<string>('PORTAL_JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
    const out: Array<Record<string, unknown>> = [];
    const userIds = new Set<string>();
    for (const key of keys) {
      const parts = key.split(':');
      if (parts.length < 3 || parts[0] !== 'sess') continue;
      const userId = parts[1];
      const sessionId = parts.slice(2).join(':');
      userIds.add(userId);
      const raw = await this.redis.get(key);
      if (!raw) continue;
      try {
        const payload = JSON.parse(raw) as Record<string, unknown>;
        const risk = await this.analytics.computeRiskScore(userId, sessionId);
        out.push({
          userId,
          sessionId,
          clienteId: null,
          device: payload,
          ip: payload.ip,
          lastSeenAt: payload.lastSeenAt,
          riskScore: risk,
          perigosa: risk > 80,
        });
      } catch {
        /* */
      }
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, email: true, clienteId: true, cpfCnpj: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return out.map((row) => {
      const u = byId.get(String(row.userId));
      return {
        ...row,
        user: u ? { email: u.email, cpfCnpj: u.cpfCnpj } : null,
        clienteId: u?.clienteId ?? null,
        ttlHintSec: Math.max(ttlHint, portalTtl),
      };
    });
  }

  @Get('logins')
  @ApiOperation({ summary: 'Últimas tentativas de login' })
  async logins() {
    return this.prisma.loginAttempt.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  @Get('anomalias')
  @ApiOperation({ summary: 'Alertas persistidos + heurística recente' })
  async anomalias(@CurrentUser() admin: AuthUser) {
    const stored = await this.analytics.listStoredAlerts(100);
    const metrics = await this.analytics.getGlobalSecurityMetrics();
    return {
      alertas: stored,
      metrics,
      geradoPor: admin.email,
    };
  }

  @Post('derrubar-sessao')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Encerrar sessão de qualquer usuário (admin)' })
  async derrubar(@Body() body: DerrubarSessaoDto): Promise<void> {
    const ttl = parseDurationToSeconds(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
    await this.sessions.removeSession(body.userId, body.sessionId, ttl);
  }

  @Post('bloquear-dispositivo')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bloquear fingerprint no Redis' })
  async bloquear(@Body() body: BloquearDispositivoDto): Promise<void> {
    await this.redis.setex(this.analytics.fingerprintBlockKey(body.fingerprint), 31_536_000, '1');
  }

  @Get('risk-matrix')
  @ApiOperation({ summary: 'Matriz de risco consolidada (7 dias)' })
  async riskMatrix() {
    return this.analytics.riskMatrix();
  }

  @Get('intrusoes')
  @ApiOperation({ summary: 'Lista completa de security_alerts' })
  async intrusoesLista() {
    return this.analytics.listStoredAlerts(500);
  }

  @Post('acao')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bloquear fingerprint, expulsar sessão ou desbloquear fingerprint' })
  async acao(@Body() body: SecurityAcaoDto): Promise<void> {
    const ttl = parseDurationToSeconds(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
    if (body.tipo === 'bloquear_dispositivo') {
      const fp = body.fingerprint?.trim();
      if (!fp) throw new BadRequestException('fingerprint obrigatório');
      await this.redis.setex(this.analytics.fingerprintBlockKey(fp), 31_536_000, '1');
      return;
    }
    if (body.tipo === 'expulsar_sessao') {
      const uid = body.userId?.trim();
      const sid = body.sessionId?.trim();
      if (!uid || !sid) throw new BadRequestException('userId e sessionId obrigatórios');
      await this.sessions.removeSession(uid, sid, ttl);
      return;
    }
    if (body.tipo === 'desbloqueio_manual') {
      const fp = body.fingerprint?.trim();
      if (!fp) throw new BadRequestException('fingerprint obrigatório');
      await this.redis.del(this.analytics.fingerprintBlockKey(fp));
    }
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'Heatmap geográfico com densidade por célula' })
  async heatmap() {
    const [pontos, celulas] = await Promise.all([
      this.analytics.heatmapFromAudits(1200),
      this.analytics.heatmapWithDensity(1),
    ]);
    return { pontos, celulas };
  }
}
