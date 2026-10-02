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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { AcaoAuditoria, Role } from '@prisma/client';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IsBoolean, IsIn, IsString, MinLength } from 'class-validator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { contextoAuditoriaPortal } from './portal-auditoria-contexto.util';
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
import { PixCreditoContaCorrenteDto } from './dto/pix-credito-conta-corrente.dto';
import { UpdatePortalSolicitacaoDto } from './dto/update-portal-solicitacao.dto';
import { UpdatePortalEmbarqueDto } from './dto/update-portal-embarque.dto';
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
import { CadastrosTiposContainerService } from '../cadastros/cadastros-tipos-container.service';
import { CadastrosLocaisTransporteService } from '../cadastros/cadastros-locais-transporte.service';
import { PatioV2Service } from '../patio-v2/patio.service';
import { PortalSolicitarTomadaDto } from '../patio-v2/dto/tomada.dto';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { CatalogoContainersService } from '../catalogo-containers/catalogo-containers.service';
import { CatalogoNaviosService } from '../catalogo-navios/catalogo-navios.service';
import { CatalogoMotoristasExternosService } from '../catalogo-motoristas-externos/catalogo-motoristas-externos.service';

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
    private readonly tiposContainer: CadastrosTiposContainerService,
    private readonly locaisTransporte: CadastrosLocaisTransporteService,
    private readonly patio: PatioV2Service,
    private readonly tenantConfig: TenantConfigService,
    private readonly catalogoContainers: CatalogoContainersService,
    private readonly catalogoNavios: CatalogoNaviosService,
    private readonly catalogoMotoristas: CatalogoMotoristasExternosService,
  ) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = req.cxUser;
    if (!u) throw new NotFoundException();
    return u;
  }

  @Get('turnos')
  @ApiOperation({ summary: 'Turnos de agendamento do terminal do cliente autenticado' })
  async turnos(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    return this.tenantConfig.getTurnosAgendamento(u.tenantId);
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

  @Get('catalogo/tipos-container')
  @ApiOperation({
    summary: 'Catálogo de tipos de contêiner ativos (MDM) para formulário de solicitação',
    description:
      'Retorna `{ items: [{ codigo, nome, tamanhos, tomadaReefer }], total }` — catálogo global do Super Admin.',
  })
  async catalogoTiposContainer(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/catalogo/tipos-container');
    return this.tiposContainer.listAtivosForPortal();
  }

  @Get('catalogo/origens-destinos')
  @ApiOperation({
    summary: 'Locais ativos de Origens e destinos para o formulário de exportação',
    description:
      'Retorna `{ items: [{ id, codigo, nome, tipo, cidade, uf }], total }` — cadastro MDM do terminal.',
  })
  async catalogoOrigensDestinos(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/catalogo/origens-destinos');
    return this.locaisTransporte.listAtivosForPortal();
  }

  @Get('containers/:iso/tomada')
  @ApiOperation({ summary: 'Status da tomada reefer do contêiner no pátio' })
  async statusTomada(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('iso') iso: string,
  ) {
    const u = this.cx(req);
    if (!u.clienteId) throw new ForbiddenException('Cliente não identificado');
    await this.audPortal(u, `GET /cliente/portal/containers/${iso}/tomada`);
    return this.patio.statusTomada(iso, u.clienteId);
  }

  @Post('containers/:iso/solicitar-tomada')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar conexão de tomada reefer durante a estadia (mid-stay)',
    description:
      'Registra pedido SOLICITADO. A operação conecta no pátio; a diária de energia passa a contar a partir da conexão.',
  })
  async solicitarTomada(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('iso') iso: string,
    @Body() dto: PortalSolicitarTomadaDto,
  ) {
    const u = this.cx(req);
    if (!u.clienteId) throw new ForbiddenException('Cliente não identificado');
    await this.audPortal(u, `POST /cliente/portal/containers/${iso}/solicitar-tomada`, undefined, AcaoAuditoria.INSERT);
    return this.patio.solicitarTomadaPortal(u.clienteId, iso, dto, u.sub);
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
  @ApiOperation({ summary: 'Faturas FAT (demonstrativo + NFS-e + boleto)' })
  async faturas(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Query('clienteId') clienteId?: string) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET financeiro/faturas');
    return this.data.faturas(u, clienteId);
  }

  @Get('financeiro/conta-corrente')
  @PessoaPode('visualizarFinanceiro')
  @ApiOperation({ summary: 'Saldo e extrato da conta corrente do cliente' })
  async contaCorrente(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Query('clienteId') clienteId?: string,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET financeiro/conta-corrente');
    return this.data.contaCorrente(u, clienteId);
  }

  @Post('financeiro/conta-corrente/pix-credito')
  @HttpCode(HttpStatus.OK)
  @PessoaPode('visualizarFinanceiro')
  @ApiOperation({ summary: 'Gera QR Code PIX para crédito na conta corrente (API do banco do terminal)' })
  async pixCreditoContaCorrente(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Body() dto: PixCreditoContaCorrenteDto,
    @Query('clienteId') clienteId?: string,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, 'POST financeiro/conta-corrente/pix-credito', undefined, AcaoAuditoria.INSERT);
    return this.data.pixCreditoContaCorrente(u, dto.valor, clienteId);
  }

  @Post('financeiro/conta-corrente/pix-credito/comprovante')
  @HttpCode(HttpStatus.CREATED)
  @PessoaPode('visualizarFinanceiro')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Envia comprovante PIX para análise manual do crédito na conta corrente' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async pixCreditoComprovante(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @UploadedFile() file: Express.Multer.File,
    @Body('valor') valorRaw: string,
    @Body('referenciaExterna') referenciaExterna: string,
    @Query('clienteId') clienteId?: string,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, 'POST financeiro/conta-corrente/pix-credito/comprovante', undefined, AcaoAuditoria.INSERT);
    return this.data.enviarComprovantePixCredito(
      u,
      { valorRaw, referenciaExterna, file },
      clienteId,
    );
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

  @Get('patio/saldo')
  @PessoaPode('verOS')
  @ApiOperation({ summary: 'Saldo de unidades depositadas no pátio' })
  async saldoPatio(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Query('clienteId') clienteIdParam?: string,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/patio/saldo');
    return this.data.saldoPatio(u, clienteIdParam);
  }

  @Patch('patio/embarque')
  @PessoaPode('verOS')
  @ApiOperation({ summary: 'Editar booking, processo ou navio de unidade depositada' })
  async atualizarEmbarquePatio(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Body() dto: UpdatePortalEmbarqueDto,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, 'PATCH /cliente/portal/patio/embarque', undefined, AcaoAuditoria.UPDATE);
    return this.data.atualizarEmbarquePatio(u, dto);
  }

  @Get('catalogo-motoristas-externos/:cpf')
  @PessoaPode('criarSolicitacao')
  @ApiOperation({ summary: 'Lookup do motorista externo deste terminal (autofill por CPF)' })
  async catalogoMotorista(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('cpf') cpf: string,
  ) {
    this.cx(req);
    return this.catalogoMotoristas.buscarPorCpfPortal(cpf);
  }

  @Get('catalogo-containers/:iso')
  @PessoaPode('criarSolicitacao')
  @ApiOperation({ summary: 'Lookup do catálogo físico da caixa (autofill da nova solicitação)' })
  async catalogoContainer(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('iso') iso: string,
  ) {
    this.cx(req);
    return this.catalogoContainers.buscar(iso);
  }

  @Get('catalogo-navios')
  @ApiOperation({ summary: 'Autocomplete de navios (catálogo compartilhado)' })
  async listarCatalogoNavios(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Query('q') q?: string,
  ) {
    this.cx(req);
    return this.catalogoNavios.listar(q, 80);
  }

  @Get('patio/unidades-estoque')
  @PessoaPode('criarSolicitacao')
  @ApiOperation({
    summary: 'Estoque do cliente (ID aberto) para coleta/exportação — só unidades desta empresa',
  })
  async unidadesEstoque(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Query('q') q?: string,
    @Query('clienteId') clienteIdParam?: string,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, 'GET /cliente/portal/patio/unidades-estoque');
    return this.data.listarEstoqueDoCliente(u, q, clienteIdParam);
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
        dadosDepois: contextoAuditoriaPortal(u, { rota, ...extra }),
      });
    } catch {
      /* não bloquear CX */
    }
  }
}
