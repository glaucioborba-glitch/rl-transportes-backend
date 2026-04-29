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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import type { Request as ExpressRequest } from 'express';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AUTH_REFRESH_COOKIE } from './auth-cookie.constants';
import { attachAuthCookies, clearAuthCookies } from './auth-cookie.util';
import { attachFreshCsrfCookie, clearCsrfCookie } from './csrf-cookie.util';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

function wantsCookieAuth(req: ExpressRequest): boolean {
  return (
    process.env.AUTH_HTTP_ONLY_COOKIES === '1' && String(req.headers['x-rl-auth-cookie'] || '') === '1'
  );
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.authService.login(dto.email, dto.password);
    if (wantsCookieAuth(req)) {
      attachAuthCookies(res, out.accessToken, out.refreshToken);
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
    const out = await this.authService.refresh(refreshToken);
    if (wantsCookieAuth(req)) {
      attachAuthCookies(res, out.accessToken, out.refreshToken);
    }
    attachFreshCsrfCookie(res);
    return out;
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
    summary: 'Encerrar sessão',
    description:
      'Invalida tokens atuais (incrementa tokenVersion). Access e refresh anteriores deixam de ser aceitos.',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Permissions('auth:sessao')
  async logout(
    @CurrentUser('id') userId: string,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    await this.authService.logout(userId, ip, userAgent);
    if (process.env.AUTH_HTTP_ONLY_COOKIES === '1') {
      clearAuthCookies(res);
    }
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
