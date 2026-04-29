import { Body, Controller, Get, NotFoundException, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AcaoAuditoria } from '@prisma/client';
import type { Request } from 'express';
import { IsString, MinLength } from 'class-validator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CxPortalSegment } from './decorators/cx-portal.decorators';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from './guards/cx-portal-auth.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalSegmentGuard } from './guards/cx-portal-segment.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import { PortalFornecedorDataService } from './services/portal-fornecedor-data.service';
import type { CxPortalRequestUser } from './types/cx-portal.types';

class ConfirmarEntregaDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  protocolo: string;
}

class EnviarDocumentoDto {
  @ApiProperty()
  @IsString()
  nome: string;

  @ApiProperty()
  @IsString()
  tipo: string;
}

@ApiTags('cx-portal-fornecedor')
@ApiBearerAuth('access-token')
@Controller('fornecedor/portal')
@UseGuards(CxPortalPublicApiForbidGuard, CxPortalAuthGuard, CxPortalRateLimitGuard, CxPortalSegmentGuard)
@CxPortalSegment('fornecedor')
@UseInterceptors(PortalCxInterceptor)
export class PortalFornecedorController {
  constructor(
    private readonly data: PortalFornecedorDataService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = req.cxUser;
    if (!u) throw new NotFoundException();
    return u;
  }

  @Get('contratos')
  @ApiOperation({ summary: 'Contratos ativos (memória CX)' })
  async contratos(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    await this.aud(u, 'GET contratos');
    return this.data.listarContratos(u);
  }

  @Get('servicos')
  @ApiOperation({ summary: 'Serviços prestados / catálogo interno' })
  async servicos(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    await this.aud(u, 'GET servicos');
    return this.data.listarServicos(u);
  }

  @Get('pagamentos')
  @ApiOperation({ summary: 'Agenda de pagamentos (proxy tesouraria / memória)' })
  async pagamentos(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    await this.aud(u, 'GET pagamentos');
    return this.data.listarPagamentos(u);
  }

  @Get('status')
  @ApiOperation({ summary: 'Status supply + conformidade GRC proxy' })
  async status(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    await this.aud(u, 'GET status');
    return this.data.status(u);
  }

  @Post('entregas/confirmar')
  @ApiOperation({ summary: 'Confirmar entrega / serviço' })
  async confirmar(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Body() body: ConfirmarEntregaDto) {
    const u = this.cx(req);
    const e = this.data.confirmarEntrega(u, body.protocolo);
    await this.aud(u, 'POST entregas/confirmar', AcaoAuditoria.INSERT, { protocolo: body.protocolo });
    return e;
  }

  @Post('documentos/enviar')
  @ApiOperation({ summary: 'Enviar metadados de documento' })
  async doc(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Body() body: EnviarDocumentoDto) {
    const u = this.cx(req);
    const d = this.data.registrarDocumento(u, body);
    await this.aud(u, 'POST documentos/enviar', AcaoAuditoria.INSERT, { docId: d.id });
    return d;
  }

  private async aud(
    u: CxPortalRequestUser,
    rota: string,
    acao: AcaoAuditoria = AcaoAuditoria.READ,
    extra?: Record<string, unknown>,
  ) {
    if (u.portalPapel !== 'STAFF') {
      return;
    }
    try {
      await this.auditoria.registrar({
        tabela: 'cx_portal',
        registroId: u.sub,
        acao,
        usuario: u.sub,
        dadosDepois: { portal: true, tipo: 'PORTAL', segmento: 'fornecedor', rota, ...extra },
      });
    } catch {
      /* noop */
    }
  }
}
