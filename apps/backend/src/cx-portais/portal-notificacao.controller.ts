import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PortalNotificacaoService } from '../portal-notificacoes/portal-notificacao.service';
import { CxPortalSegment } from './decorators/cx-portal.decorators';
import { CxPortalPublicApiForbidGuard } from './guards/cx-portal-auth.guard';
import { JwtPortalAuthGuard } from './guards/jwt-portal.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalSegmentGuard } from './guards/cx-portal-segment.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import type { CxPortalRequestUser } from './types/cx-portal.types';

@ApiTags('cx-portal-notificacoes')
@ApiBearerAuth('access-token')
@Controller('cliente/portal/notificacoes')
@UseGuards(
  CxPortalPublicApiForbidGuard,
  JwtPortalAuthGuard,
  CxPortalRateLimitGuard,
  CxPortalSegmentGuard,
)
@CxPortalSegment('cliente')
@UseInterceptors(PortalCxInterceptor)
export class PortalNotificacaoController {
  constructor(private readonly notificacoes: PortalNotificacaoService) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = req.cxUser;
    if (!u) throw new NotFoundException();
    return u;
  }

  private clienteId(req: Request & { cxUser?: CxPortalRequestUser }): string {
    const id = this.cx(req).clienteId?.trim();
    if (!id) throw new ForbiddenException('Sessão portal sem cliente vinculado.');
    return id;
  }

  @Get()
  @ApiOperation({ summary: 'Listar notificações do cliente no portal' })
  listar(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    return this.notificacoes.listar(this.clienteId(req));
  }

  @Get('nao-lidas')
  @ApiOperation({ summary: 'Quantidade de notificações não lidas' })
  naoLidas(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    return this.notificacoes.contarNaoLidas(this.clienteId(req));
  }

  @Post('marcar-todas-lidas')
  @ApiOperation({ summary: 'Marcar todas as notificações como lidas' })
  marcarTodas(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    return this.notificacoes.marcarTodasLidas(this.clienteId(req));
  }

  @Patch(':id/lida')
  @ApiOperation({ summary: 'Marcar uma notificação como lida' })
  marcarLida(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('id') id: string,
  ) {
    return this.notificacoes.marcarLida(id, this.clienteId(req));
  }
}
