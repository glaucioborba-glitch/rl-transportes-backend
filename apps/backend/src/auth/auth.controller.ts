import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { PortalIdentityService } from '../cx-portais/identity/portal-identity.service';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from './auth-cookie.constants';
import { attachAccessCookie, attachAuthCookies, clearAuthCookies } from './auth-cookie.util';
import { attachFreshCsrfCookie, clearCsrfCookie } from './csrf-cookie.util';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';
import { AuthResetPasswordDto } from './dto/auth-reset-password.dto';
import { CpfCnpjValidationPipe } from '../common/pipes/cpf-cnpj-validation.pipe';
import { CorporateCpfCnpjPipe } from '../corporate-auth/validators/corporate-cpf-cnpj.pipe';
import { resolveLoginTenantId } from '../tenant/resolve-login-tenant.util';

function wantsCookieAuth(req: ExpressRequest): boolean {
  return (
    process.env.AUTH_HTTP_ONLY_COOKIES === '1' && String(req.headers['x-rl-auth-cookie'] || '') === '1'
  );
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly portalIdentity: PortalIdentityService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastro portal (mesmo fluxo que POST /portal/register)' })
  async register(@Body(CpfCnpjValidationPipe) body: AuthRegisterDto) {
    return this.portalIdentity.registrarClientePortal(body);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefinir senha com token (mesmo fluxo que POST /portal/redefinir-senha)' })
  async resetPassword(@Body() body: AuthResetPasswordDto) {
    return this.portalIdentity.redefinirSenhaComToken(body.token, body.newPassword);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(CorporateCpfCnpjPipe) dto: LoginDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieMode = wantsCookieAuth(req);
    if (cookieMode) {
      clearAuthCookies(res);
    }
    const ip = req.ip || req.socket?.remoteAddress || undefined;
    const userAgent = req.get('user-agent') || undefined;
    const tenantId = resolveLoginTenantId({ bodyTenantId: dto.tenantId, req });
    const out = await this.authService.login(tenantId, dto.documento, dto.password, { ip, userAgent }, req);
    if (cookieMode) {
      attachAuthCookies(res, out.accessToken, out.refreshToken);
      attachFreshCsrfCookie(res);
      return { user: out.user };
    }
    attachFreshCsrfCookie(res);
    return out;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fromCookie =
      process.env.AUTH_HTTP_ONLY_COOKIES === '1'
        ? (req as ExpressRequest & { cookies?: Record<string, string> }).cookies?.[AUTH_REFRESH_COOKIE]
        : undefined;
    const refreshToken = dto.refreshToken || fromCookie;
    if (!refreshToken || refreshToken.length < 10) {
      throw new BadRequestException('refreshToken obrigatório (body ou cookie rl_rt)');
    }
    const out = await this.authService.refresh(refreshToken, req);
    if (wantsCookieAuth(req)) {
      clearAuthCookies(res);
      attachAuthCookies(res, out.accessToken, out.refreshToken);
    }
    attachFreshCsrfCookie(res);
    return wantsCookieAuth(req) ? { ok: true } : out;
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Heartbeat de sessão staff (cookie HttpOnly)',
    description:
      'Valida o JWT do cookie rl_at e renova silenciosamente quando o tempo restante de vida cair abaixo de 30%.',
  })
  async health(@Request() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const accessToken = (req as ExpressRequest & { cookies?: Record<string, string> }).cookies?.[
      AUTH_ACCESS_COOKIE
    ];
    if (!accessToken?.trim()) {
      throw new UnauthorizedException('Cookie de acesso ausente');
    }
    const out = await this.authService.sessionHealth(accessToken, req);
    if (out.renewed && out.accessToken) {
      attachAccessCookie(res, out.accessToken);
      attachFreshCsrfCookie(res);
    }
    return { ok: true, renewed: out.renewed };
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Permissions('auth:sessao')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Encerrar sessão atual',
    description:
      'Remove a sessão atual no Redis (quando JWT inclui sid). Sem sid, incrementa tokenVersion (logout global legado).',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Permissions('auth:sessao')
  async logout(
    @CurrentUser() user: AuthUser,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    await this.authService.logout(user.id, {
      sessionId: user.sid,
      ip,
      userAgent,
    });
    clearAuthCookies(res);
    clearCsrfCookie(res);
  }

  @Post('users')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN)
  @Permissions('users:criar')
  createUser(@Body() dto: CreateUserDto, @Request() req: ExpressRequest & { user: AuthUser }) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.authService.createUser(dto, req.user.id, ip, userAgent);
  }
}
