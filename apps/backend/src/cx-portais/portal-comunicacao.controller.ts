import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AcaoAuditoria } from '@prisma/client';
import type { Request } from 'express';
import { IsIn, IsString, MinLength } from 'class-validator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from './guards/cx-portal-auth.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import { PortalTicketsStore } from './stores/portal-tickets.store';
import type { CxPortalRequestUser } from './types/cx-portal.types';

class NovoTicketDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  assunto: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  corpo: string;

  @ApiProperty({ enum: ['operacional', 'financeiro', 'outro'] })
  @IsIn(['operacional', 'financeiro', 'outro'])
  categoria: 'operacional' | 'financeiro' | 'outro';
}

class RespostaTicketDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  texto: string;
}

@ApiTags('cx-portal-comunicacao')
@ApiBearerAuth('access-token')
@Controller('portal/tickets')
@UseGuards(CxPortalPublicApiForbidGuard, CxPortalAuthGuard, CxPortalRateLimitGuard)
@UseInterceptors(PortalCxInterceptor)
export class PortalComunicacaoController {
  constructor(
    private readonly tickets: PortalTicketsStore,
    private readonly auditoria: AuditoriaService,
  ) {}

  private u(req: Request & { cxUser?: CxPortalRequestUser }) {
    const x = req.cxUser;
    if (!x) throw new NotFoundException();
    return x;
  }

  @Post()
  @ApiOperation({ summary: 'Abrir ticket (chamado centralizado)' })
  async criar(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Body() body: NovoTicketDto) {
    const cx = this.u(req);
    const t = this.tickets.criar({
      tenantId: cx.tenantId,
      autorSub: cx.sub,
      portalPapel: cx.portalPapel,
      assunto: body.assunto,
      corpo: body.corpo,
      categoria: body.categoria,
    });
    await this.aud(cx, AcaoAuditoria.INSERT, { ticketId: t.id });
    return t;
  }

  @Get()
  @ApiOperation({ summary: 'Listar tickets (staff vê tenant; demais só próprios)' })
  async listar(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Query('tenantId') tenantId?: string,
  ) {
    const cx = this.u(req);
    if (cx.portalPapel === 'STAFF') {
      const tid = tenantId?.trim() || cx.tenantId;
      return this.tickets.listar({ tenantId: tid });
    }
    return this.tickets.listar({ tenantId: cx.tenantId, autorSub: cx.sub });
  }

  @Post(':id/respostas')
  @ApiOperation({ summary: 'Responder ticket' })
  async responder(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('id') id: string,
    @Body() body: RespostaTicketDto,
  ) {
    const cx = this.u(req);
    const t = this.tickets.obter(id);
    if (!t) throw new NotFoundException('Ticket não encontrado');
    if (cx.portalPapel !== 'STAFF' && t.autorSub !== cx.sub) {
      throw new NotFoundException('Ticket não encontrado');
    }
    const atualizado = this.tickets.responder(id, cx.sub, body.texto);
    await this.aud(cx, AcaoAuditoria.UPDATE, { ticketId: id });
    return atualizado;
  }

  private async aud(cx: CxPortalRequestUser, acao: AcaoAuditoria, extra: Record<string, unknown>) {
    if (cx.portalPapel === 'FORNECEDOR' || cx.portalPapel === 'PARCEIRO') {
      return;
    }
    try {
      await this.auditoria.registrar({
        tabela: 'cx_portal_ticket',
        registroId: cx.sub,
        acao,
        usuario: cx.sub,
        dadosDepois: { portal: true, tipo: 'PORTAL', ...extra },
      });
    } catch {
      /* noop */
    }
  }
}
