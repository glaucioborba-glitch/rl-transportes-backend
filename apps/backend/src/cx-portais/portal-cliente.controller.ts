import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AcaoAuditoria, Role } from '@prisma/client';
import type { Request } from 'express';
import { IsBoolean, IsIn, IsString, MinLength } from 'class-validator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { PlataformaMarketplaceService } from '../plataforma-integracao/services/plataforma-marketplace.service';
import type { PlataformaServicoId } from '../plataforma-integracao/plataforma.types';
import { SolicitacoesService } from '../solicitacoes/solicitacoes.service';
import { CxPortalSegment } from './decorators/cx-portal.decorators';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from './guards/cx-portal-auth.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalSegmentGuard } from './guards/cx-portal-segment.guard';
import { PortalCadastroAprovadoGuard } from './guards/portal-cadastro-aprovado.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import { PortalClienteSolicitacoesQueryDto } from './dto/portal-cliente-solicitacoes-query.dto';
import { UpdatePortalSolicitacaoDto } from './dto/update-portal-solicitacao.dto';
import { PortalClienteDataService } from './services/portal-cliente-data.service';
import { PortalMarketplaceCxStore } from './stores/portal-marketplace-cx.store';
import { PortalTicketsStore } from './stores/portal-tickets.store';
import type { CxPortalRequestUser } from './types/cx-portal.types';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../auth/session/session.service';
import { parseDurationToSeconds } from '../auth/session/session.util';
import { PessoaPermissoesGuard } from '../common/guards/pessoa-permissoes.guard';
import { PessoaPode } from '../common/decorators/pessoa-pode.decorator';
import { Iso6346ValidationPipe } from '../common/pipes/iso6346-validation.pipe';
import { AgendamentosService } from '../agendamentos/agendamentos.service';
import { PortalCreateAgendamentoDto } from '../agendamentos/dto/portal-create-agendamento.dto';
import { YardSnapshotService } from '../yard-read/yard-snapshot.service';

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
@UseGuards(CxPortalPublicApiForbidGuard, CxPortalAuthGuard, CxPortalRateLimitGuard, CxPortalSegmentGuard, PessoaPermissoesGuard)
@CxPortalSegment('cliente')
@UseInterceptors(PortalCxInterceptor)
export class PortalClienteController {
  constructor(
    private readonly data: PortalClienteDataService,
    private readonly tickets: PortalTicketsStore,
    private readonly auditoria: AuditoriaService,
    private readonly marketplace: PlataformaMarketplaceService,
    private readonly marketplaceCx: PortalMarketplaceCxStore,
    private readonly solicitacoesService: SolicitacoesService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
    private readonly agendamentosService: AgendamentosService,
    private readonly yardSnapshot: YardSnapshotService,
  ) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = req.cxUser;
    if (!u) throw new NotFoundException();
    return u;
  }

  @Get('sessoes-ativas/auditoria')
  @ApiOperation({ summary: 'Histórico de auditoria de dispositivo (portal cliente)' })
  async sessoesAuditoria(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/sessoes-ativas/auditoria');
    return this.sessionService.getDeviceAudit(u.sub, 100);
  }

  @Get('sessoes-ativas')
  @ApiOperation({ summary: 'Sessões ativas enriquecidas (Redis)' })
  async sessoesAtivas(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/sessoes-ativas');
    return this.sessionService.getActiveSessions(u.sub);
  }

  @Delete('sessoes-ativas/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Encerrar outra sessão do mesmo usuário' })
  async encerrarSessao(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('sessionId') sessionId: string,
  ): Promise<void> {
    const u = this.cx(req);
    await this.audPortal(u, `DELETE /cliente/portal/sessoes-ativas/${sessionId}`);
    const ttl = parseDurationToSeconds(
      this.configService.get<string>('PORTAL_JWT_REFRESH_EXPIRES_IN') ?? '7d',
    );
    await this.sessionService.assertSessionOwnedAndRemove(u.sub, sessionId, ttl);
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

  @Get('solicitacoes/:id/historico-alteracoes')
  @ApiOperation({ summary: 'Histórico imutável de alterações críticas da solicitação' })
  async historicoAlteracoesSolicitacao(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('id') id: string,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, `GET /cliente/portal/solicitacoes/${id}/historico-alteracoes`);
    return this.data.historicoAlteracoesSolicitacao(u, id);
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

  @Patch('solicitacoes/:id/aprovar')
  @PessoaPode('aprovarOS')
  @ApiOperation({ summary: 'Aprovar solicitação pendente (JWT portal CLIENTE)' })
  async aprovarSolicitacao(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('id') id: string,
  ) {
    const u = this.cx(req);
    if (u.portalPapel !== 'CLIENTE' || !u.clienteId) {
      throw new ForbiddenException('Aprovação exclusiva do usuário cliente (portal IAM).');
    }
    const ip = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    const actor: AuthUser = {
      sub: u.sub,
      id: u.sub,
      email: u.email,
      cpfCnpj: u.cpfCnpj,
      role: Role.CLIENTE,
      permissions: [],
      clienteId: u.clienteId,
    };
    await this.audPortal(u, `PATCH /cliente/portal/solicitacoes/${id}/aprovar`, undefined, AcaoAuditoria.UPDATE);
    return this.solicitacoesService.aprovarPeloCliente(id, actor, ip, userAgent);
  }

  @Patch('solicitacoes/:id')
  @PessoaPode('criarSolicitacao')
  @ApiOperation({ summary: 'Editar solicitação do portal (ISO imutável)' })
  async atualizarSolicitacao(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('id') id: string,
    @Body() dto: UpdatePortalSolicitacaoDto,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, `PATCH /cliente/portal/solicitacoes/${id}`, undefined, AcaoAuditoria.UPDATE);
    return this.data.atualizarSolicitacaoPortal(u, id, dto);
  }

  @Post('solicitacoes/:id/cancelar')
  @HttpCode(HttpStatus.OK)
  @PessoaPode('criarSolicitacao')
  @ApiOperation({ summary: 'Cancelar solicitação pelo cliente (CANCELADO_CLIENTE)' })
  async cancelarSolicitacao(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('id') id: string,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, `POST /cliente/portal/solicitacoes/${id}/cancelar`, undefined, AcaoAuditoria.UPDATE);
    return this.data.cancelarSolicitacaoPortal(u, id);
  }

  @Get('eventos')
  @ApiOperation({ summary: 'Linha do tempo operacional (proxy de eventos)' })
  async eventos(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Query('clienteId') clienteId?: string) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/eventos');
    return this.data.eventos(u, clienteId);
  }

  @Get('financeiro/faturas')
  @PessoaPode('visualizarFinanceiro')
  @ApiOperation({ summary: 'Faturas (read-only)' })
  async faturas(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Query('clienteId') clienteId?: string) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET financeiro/faturas');
    return this.data.faturas(u, clienteId);
  }

  @Get('financeiro/faturas-armazenagem')
  @PessoaPode('visualizarFinanceiro')
  @ApiOperation({ summary: 'Faturas Gate-Out (armazenagem) com NFS-e, boleto e PIX' })
  async faturasArmazenagem(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Query('clienteId') clienteId?: string,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET financeiro/faturas-armazenagem');
    return this.data.faturasArmazenagem(u, clienteId);
  }

  @Get('financeiro/boletos')
  @PessoaPode('visualizarFinanceiro')
  @ApiOperation({ summary: 'Boletos (read-only)' })
  async boletos(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Query('clienteId') clienteId?: string) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET financeiro/boletos');
    return this.data.boletos(u, clienteId);
  }

  @Get('financeiro/nfse')
  @PessoaPode('visualizarFinanceiro')
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

  @Get('pilhas')
  @ApiOperation({ summary: 'Patiamento digital — read model Redis (CQRS)' })
  async pilhas(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Query('clienteId') clienteIdParam?: string,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/pilhas');
    const clienteId =
      u.auth === 'staff' && (u.staffRole === Role.ADMIN || u.staffRole === Role.GERENTE)
        ? (clienteIdParam ?? u.clienteId ?? undefined)
        : u.clienteId ?? undefined;
    if (!clienteId) {
      throw new NotFoundException('Cliente não identificado');
    }
    return this.yardSnapshot.getSnapshotForCliente(clienteId);
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
    const t = await this.tickets.criar({
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
    const habilitados = await this.marketplaceCx.obter(u.tenantId, u.sub);
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
    const ativos = await this.marketplaceCx.definir(u.tenantId, u.sub, id, body.ativo);
    await this.audPortal(u, 'POST marketplace/features', { servicoId: body.servicoId, ativo: body.ativo }, AcaoAuditoria.UPDATE);
    return { success: true, servicosContratadosCx: ativos };
  }

  @Post('agendamentos')
  @UseGuards(PortalCadastroAprovadoGuard)
  @PessoaPode('agendarTurno')
  @ApiOperation({
    summary: 'Criar agendamento terminal (Gate In/Out) com modalidade de transporte',
  })
  async criarAgendamento(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Body(Iso6346ValidationPipe) dto: PortalCreateAgendamentoDto,
  ) {
    const u = this.cx(req);
    if (!u.clienteId) {
      throw new ForbiddenException('Sessão portal sem cliente vinculado.');
    }
    await this.audPortal(u, 'POST /cliente/portal/agendamentos', {
      numeroIso: dto.numeroIso,
      tipoOperacao: dto.tipoOperacao,
      modalidadeTransporte: dto.modalidadeTransporte,
    }, AcaoAuditoria.INSERT);
    return this.agendamentosService.criarPortal(dto, u.clienteId, u.sub);
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
