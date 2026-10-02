import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CxPortalSegment } from './decorators/cx-portal.decorators';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from './guards/cx-portal-auth.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalSegmentGuard } from './guards/cx-portal-segment.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import type { CxPortalRequestUser } from './types/cx-portal.types';
import { PortalSecurityService } from '../security-center/portal-security.service';
import { SessionService } from '../auth/session/session.service';
import { SecurityAnalyticsService } from '../security-center/security-analytics.service';

@ApiTags('cx-portal-security')
@ApiBearerAuth('access-token')
@Controller('cliente/security')
@UseGuards(CxPortalPublicApiForbidGuard, CxPortalAuthGuard, CxPortalRateLimitGuard, CxPortalSegmentGuard)
@CxPortalSegment('cliente')
@UseInterceptors(PortalCxInterceptor)
export class SecurityPortalController {
  constructor(
    private readonly portalSecurity: PortalSecurityService,
    private readonly sessions: SessionService,
    private readonly analytics: SecurityAnalyticsService,
  ) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }): CxPortalRequestUser {
    const u = req.cxUser;
    if (!u || u.portalPapel !== 'CLIENTE' || !u.clienteId) {
      throw new ForbiddenException('Portal cliente obrigatório');
    }
    return u;
  }

  @Get('risk-profile')
  @ApiOperation({ summary: 'Perfil de risco (banner, selo, recomendações)' })
  async riskProfile(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    return this.portalSecurity.getRiskProfile(u.sub, u.clienteId ?? null, u.sid, req);
  }

  @Get('intrusoes')
  @ApiOperation({ summary: 'Alertas CRÍTICO/ALTO do cliente' })
  async intrusoes(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    return this.portalSecurity.listIntrusoesCliente(u.clienteId as string);
  }

  @Get('sessoes')
  @ApiOperation({ summary: 'Sessões ativas com riskScore e flag perigosa (>80)' })
  async sessoes(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    const rows = await this.sessions.getActiveSessions(u.sub);
    return Promise.all(
      rows.map(async (r) => {
        const riskScore = await this.analytics.computeRiskScore(u.sub, r.sessionId);
        return {
          ...r,
          riskScore,
          perigosa: riskScore > 80,
        };
      }),
    );
  }

  @Get('geo-recentes')
  @ApiOperation({ summary: 'Últimas 50 coordenadas de acesso (usuários do cliente)' })
  async geoRecentes(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    const pontos = await this.portalSecurity.getUltimasCoordsCliente(u.clienteId as string);
    return { pontos };
  }

  @Post('sessoes/revogar-outras')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Encerrar todas as sessões exceto a atual (JWT sid)' })
  async revogarOutras(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    const n = await this.portalSecurity.revokeAllSessionsExcept(u.sub, u.sid);
    return { revogadas: n };
  }
}
