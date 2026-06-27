import { Body, BadRequestException, Controller, Get, Header, HttpCode, HttpStatus, NotFoundException, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response, Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PortalIdentityService } from './portal-identity.service';
import { attachFreshCsrfCookie } from '../../auth/csrf-cookie.util';
import { PortalRegisterDto } from '../dto/portal-register.dto';
import { PortalLoginDto } from '../dto/portal-login.dto';
import { CpfCnpjValidationPipe } from '../../common/pipes/cpf-cnpj-validation.pipe';
import {
  attachPortalAuthCookies,
  clearPortalAuthCookies,
} from './portal-cookie.attach';
import {
  extractPortalRefreshToken,
  wantsPortalCookieAuth,
} from './portal-cookie.util';
import { CxPortalAuthGuard } from '../guards/cx-portal-auth.guard';
import { CurrentCxUser } from '../decorators/current-cx-user.decorator';
import type { CxPortalRequestUser } from '../types/cx-portal.types';
import { resolveLoginTenantId } from '../../tenant/resolve-login-tenant.util';

class PortalRefreshDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

class Portal2faDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  code?: string;
}

class PortalEsqueciSenhaDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

class PortalRedefinirSenhaDto {
  @ApiProperty({ description: 'Token UUID enviado por e-mail' })
  @IsString()
  @MinLength(10)
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  novaSenha!: string;
}

@ApiTags('cx-portal-iam')
@Controller('portal')
export class PortalIdentityController {
  constructor(private readonly identity: PortalIdentityService) {}

  @Get('email-preview')
  @ApiOperation({ summary: 'Somente desenvolvimento: HTML do e-mail de recuperação de senha' })
  @Header('Content-Type', 'text/html; charset=utf-8')
  emailPreview(@Query('token') token?: string, @Query('nome') nome?: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    return this.identity.getResetPreviewHtml(nome?.trim() || 'Cliente exemplo', token?.trim() || 'exemplo-uuid');
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastro self-service (CLIENTE + Cliente Prisma)' })
  async register(@Body(CpfCnpjValidationPipe) body: PortalRegisterDto, @Res({ passthrough: true }) res: Response) {
    const out = await this.identity.registrarClientePortal(body);
    attachFreshCsrfCookie(res);
    return out;
  }

  @Post('esqueci-senha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar link de redefinição (mock: log no servidor)' })
  async esqueciSenha(@Body() body: PortalEsqueciSenhaDto, @Res({ passthrough: true }) res: Response) {
    const out = await this.identity.pedirRecuperacaoSenha(body.email);
    attachFreshCsrfCookie(res);
    return out;
  }

  @Post('redefinir-senha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Concluir redefinição com token recebido por e-mail' })
  async redefinirSenha(@Body() body: PortalRedefinirSenhaDto, @Res({ passthrough: true }) res: Response) {
    const out = await this.identity.redefinirSenhaComToken(body.token, body.novaSenha);
    attachFreshCsrfCookie(res);
    return out;
  }

  @Post('login')
  @ApiOperation({
    summary: 'Login IAM portal (JWT híbrido)',
    description:
      '**CLIENTE:** usuário Prisma `Role.CLIENTE`. **FORNECEDOR/PARCEIRO:** seed em memória `CX_PORTAL_FORNECEDOR_SEED`. Chaves públicas Fase 18 **não** autenticam aqui.',
  })
  async login(
    @Body() body: PortalLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieMode = wantsPortalCookieAuth(req);
    if (cookieMode) clearPortalAuthCookies(res);
    const tenantId = resolveLoginTenantId({ bodyTenantId: body.tenantId, req });
    const out = await this.identity.login(body.documento, body.password, body.papel, tenantId, req);
    if (cookieMode) {
      attachPortalAuthCookies(res, out.accessToken, out.refreshToken);
      attachFreshCsrfCookie(res);
      const { accessToken: _a, refreshToken: _r, tokenType: _t, ...session } = out;
      return session;
    }
    attachFreshCsrfCookie(res);
    return out;
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh token portal (par de tokens dedicados)' })
  async refresh(@Body() body: PortalRefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieMode = wantsPortalCookieAuth(req);
    const fromCookie = extractPortalRefreshToken(req);
    const refreshToken = body.refreshToken || fromCookie;
    if (!refreshToken?.trim()) {
      throw new BadRequestException('refreshToken obrigatório (body ou cookie rl_prt)');
    }
    const out = await this.identity.refresh(refreshToken, req);
    if (cookieMode) {
      attachPortalAuthCookies(res, out.accessToken, out.refreshToken);
      attachFreshCsrfCookie(res);
      return { ok: true };
    }
    attachFreshCsrfCookie(res);
    return out;
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @UseGuards(CxPortalAuthGuard)
  @ApiOperation({ summary: 'Snapshot da sessão portal (cookie HttpOnly ou Bearer)' })
  async me(@CurrentCxUser() cx: CxPortalRequestUser) {
    return this.identity.buildSessionView(cx);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @UseGuards(CxPortalAuthGuard)
  @ApiOperation({ summary: 'Encerra sessão portal (cookies rl_pat / rl_prt)' })
  logout(@Res({ passthrough: true }) res: Response) {
    clearPortalAuthCookies(res);
  }

  @Post('2fa')
  @ApiOperation({ summary: '2FA opcional (stub nesta fase)' })
  async twoFa(@Body() body: Portal2faDto) {
    return this.identity.twoFaStub(body);
  }
}
