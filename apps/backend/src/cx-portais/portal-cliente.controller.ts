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
import { IsBoolean, IsIn, IsString, MinLength } from 'class-validator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PlataformaMarketplaceService } from '../plataforma-integracao/services/plataforma-marketplace.service';
import type { PlataformaServicoId } from '../plataforma-integracao/plataforma.types';
import { CxPortalSegment } from './decorators/cx-portal.decorators';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from './guards/cx-portal-auth.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalSegmentGuard } from './guards/cx-portal-segment.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import { PortalClienteSolicitacoesQueryDto } from './dto/portal-cliente-solicitacoes-query.dto';
import { PortalClienteDataService } from './services/portal-cliente-data.service';
import { PortalMarketplaceCxStore } from './stores/portal-marketplace-cx.store';
import { PortalTicketsStore } from './stores/portal-tickets.store';
import type { CxPortalRequestUser } from './types/cx-portal.types';

class ChamadoDto {
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

class MarketplaceFeatureDto {
  @ApiProperty({ example: 'tracking_operacional' })
  @IsString()
  servicoId: string;

  @ApiProperty()
  @IsBoolean()
  ativo: boolean;
}

@ApiTags('cx-portal-cliente')
@ApiBearerAuth('access-token')
@Controller('cliente/portal')
@UseGuards(CxPortalPublicApiForbidGuard, CxPortalAuthGuard, CxPortalRateLimitGuard, CxPortalSegmentGuard)
@CxPortalSegment('cliente')
@UseInterceptors(PortalCxInterceptor)
export class PortalClienteController {
  constructor(
    private readonly data: PortalClienteDataService,
    private readonly tickets: PortalTicketsStore,
    private readonly auditoria: AuditoriaService,
    private readonly marketplace: PlataformaMarketplaceService,
    private readonly marketplaceCx: PortalMarketplaceCxStore,
  ) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = req.cxUser;
    if (!u) throw new NotFoundException();
    return u;
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard B2B autosserviço', description: '**Roles:** JWT portal `CLIENTE` ou staff `ADMIN`/`GERENTE` com `?clienteId=`.' })
  async dashboard(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Query('clienteId') clienteId?: string) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/dashboard');
    return this.data.dashboard(u, clienteId);
  }

  @Get('solicitacoes')
  @ApiOperation({
    summary: 'Listar solicitações (paginado, tracking ciclo operacional)',
    description:
      'Retorno: `{ items, total, page, limit, orderBy, order }`. Staff deve enviar `clienteId` na query.',
  })
  async solicitacoes(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Query() query: PortalClienteSolicitacoesQueryDto,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/solicitacoes');
    return this.data.listarSolicitacoesPaginado(u, query);
  }

  @Get('solicitacoes/:id')
  @ApiOperation({ summary: 'Detalhe solicitação' })
  async solicitacao(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('id') id: string,
  ) {
    const u = this.cx(req);
    const s = await this.data.obterSolicitacao(u, id);
    if (!s) throw new NotFoundException('Solicitação não encontrada');
    await this.audPortal(u, `GET /cliente/portal/solicitacoes/${id}`);
    return s;
  }

  @Get('eventos')
  @ApiOperation({ summary: 'Linha do tempo operacional (proxy de eventos)' })
  async eventos(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Query('clienteId') clienteId?: string) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/eventos');
    return this.data.eventos(u, clienteId);
  }

  @Get('financeiro/faturas')
  @ApiOperation({ summary: 'Faturas (read-only)' })
  async faturas(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Query('clienteId') clienteId?: string) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET financeiro/faturas');
    return this.data.faturas(u, clienteId);
  }

  @Get('financeiro/boletos')
  @ApiOperation({ summary: 'Boletos (read-only)' })
  async boletos(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Query('clienteId') clienteId?: string) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET financeiro/boletos');
    return this.data.boletos(u, clienteId);
  }

  @Get('financeiro/nfse')
  @ApiOperation({ summary: 'NFSe emitidas (read-only)' })
  async nfse(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Query('clienteId') clienteId?: string) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET financeiro/nfse');
    return this.data.nfses(u, clienteId);
  }

  @Get('slas')
  @ApiOperation({ summary: 'SLAs e histórico proxy' })
  async slas(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/slas');
    return this.data.slas(u);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'KPIs personalizáveis (branding)' })
  async kpis(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Query('clienteId') clienteId?: string) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/kpis');
    return this.data.kpis(u, clienteId);
  }

  @Get('relatorios/export')
  @ApiOperation({ summary: 'Export JSON/CSV simulado' })
  async export(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Query('formato') formato: 'json' | 'csv' = 'json',
    @Query('clienteId') clienteId?: string,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET relatorios/export');
    const f = formato === 'csv' ? 'csv' : 'json';
    return this.data.exportResumo(u, f, clienteId);
  }

  @Post('chamados')
  @ApiOperation({ summary: 'Abrir chamado (ticket) — integrado ao módulo de comunicação' })
  async chamados(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Body() body: ChamadoDto) {
    const u = this.cx(req);
    const t = this.tickets.criar({
      tenantId: u.tenantId,
      autorSub: u.sub,
      portalPapel: u.portalPapel,
      assunto: body.assunto,
      corpo: body.corpo,
      categoria: body.categoria,
    });
    await this.audPortal(u, 'POST chamados', { ticketId: t.id }, AcaoAuditoria.INSERT);
    return t;
  }

  @Get('marketplace/servicos')
  @ApiOperation({ summary: 'Catálogo marketplace (envelope estilo Fase 18)' })
  async servicosMarketplace(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    const data = this.marketplace.listarServicos();
    const habilitados = this.marketplaceCx.obter(u.tenantId, u.sub);
    return {
      success: true,
      data,
      meta: { tenantId: u.tenantId, servicosContratadosCx: habilitados },
    };
  }

  @Post('marketplace/features')
  @ApiOperation({ summary: 'Contratar/descontratar feature (sem cobrança nesta fase)' })
  async features(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Body() body: MarketplaceFeatureDto) {
    const u = this.cx(req);
    const id = body.servicoId as PlataformaServicoId;
    const ativos = this.marketplaceCx.definir(u.tenantId, u.sub, id, body.ativo);
    await this.audPortal(u, 'POST marketplace/features', { servicoId: body.servicoId, ativo: body.ativo }, AcaoAuditoria.UPDATE);
    return { success: true, servicosContratadosCx: ativos };
  }

  private async audPortal(
    u: CxPortalRequestUser,
    rota: string,
    extra?: Record<string, unknown>,
    acao: AcaoAuditoria = AcaoAuditoria.READ,
  ) {
    try {
      await this.auditoria.registrar({
        tabela: 'cx_portal',
        registroId: u.sub,
        acao,
        usuario: u.sub,
        dadosDepois: { portal: true, tipo: 'PORTAL', rota, portalPapel: u.portalPapel, ...extra },
      });
    } catch {
      /* não bloquear CX */
    }
  }
}
