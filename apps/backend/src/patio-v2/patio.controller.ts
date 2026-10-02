import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PatioMovimentarDto } from './dto/movimentar.dto';
import { ConfirmarPatioFilaDto, EnfileirarPatioDto, RemocaoPatioFilaDto } from './dto/patio-fila.dto';
import { PatioPosicionarDto, PatioPrepararGateOutDto } from './dto/posicionar.dto';
import { PatioSaldoQueryDto } from './dto/saldo-query.dto';
import { PatioTomadaConectarDto, PatioTomadaDesconectarDto } from './dto/tomada.dto';
import { PatioFilaService } from './patio-fila.service';
import { PatioSaldoRelatorioService } from './patio-saldo-relatorio.service';
import { PatioV2Service } from './patio.service';

const PATIO_ROLES: Role[] = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_PATIO,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PORTARIA,
];

@ApiTags('patio-v2')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('v2/patio')
export class PatioV2Controller {
  constructor(
    private readonly patio: PatioV2Service,
    private readonly fila: PatioFilaService,
    private readonly saldoRelatorio: PatioSaldoRelatorioService,
  ) {}

  @Post('fila')
  @ApiOperation({ summary: 'Envia a RIC confirmada para a fila do pátio, com urgência' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  enfileirar(@Body() dto: EnfileirarPatioDto) {
    return this.fila.enfileirar(dto.protocolo, dto.urgencia);
  }

  @Get('fila')
  @ApiOperation({ summary: 'Lista a fila do pátio (prioritário → preferencial → normal, FIFO no grupo)' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  listarFila() {
    return this.fila.listar();
  }

  @Get('fila/posicoes')
  @ApiOperation({ summary: 'Posições para o tablet (cadastro, pátio ou grade simulada)' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  posicoesFila() {
    return this.fila.posicoes();
  }

  @Post('fila/remocao')
  @ApiOperation({ summary: 'Remove a unidade de uma posição ocupada para um espaço livre' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  remocaoFila(@Body() dto: RemocaoPatioFilaDto, @CurrentUser() user: AuthUser) {
    return this.fila.remocao(user.id, dto.origemCodigo, dto.destinoCodigo);
  }

  @Post('fila/:id/confirmar')
  @ApiOperation({ summary: 'Confirma baixa ou coleta e grava a posição' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  confirmarFila(
    @Param('id') id: string,
    @Body() dto: ConfirmarPatioFilaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.fila.confirmar(id, user.id, dto.posicaoCodigo);
  }

  @Post('posicionar')
  @ApiOperation({ summary: 'Posicionar unidade recém-entrada (Gate In) em baia' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  posicionar(@Body() dto: PatioPosicionarDto, @CurrentUser() user: AuthUser) {
    return this.patio.posicionar(user.id, dto);
  }

  @Post('movimentar')
  @ApiOperation({ summary: 'Movimentação interna (shift, lift on/off, reposicionamento)' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  movimentar(@Body() dto: PatioMovimentarDto, @CurrentUser() user: AuthUser) {
    return this.patio.movimentar(user.id, dto);
  }

  @Post('preparar-gate-out')
  @ApiOperation({ summary: 'Marca unidades e solicitação como AGUARDANDO_GATE_OUT' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  prepararGateOut(@Body() dto: PatioPrepararGateOutDto, @CurrentUser() user: AuthUser) {
    return this.patio.prepararGateOut(dto.solicitacaoId, user.id);
  }

  @Get('inventario')
  @ApiOperation({ summary: 'Inventário em tempo real — saldo de unidades, baias, lotação' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  inventario() {
    return this.patio.inventario();
  }

  @Get('saldo/pdf')
  @ApiOperation({ summary: 'Relatório PDF do saldo de unidades (timbre da empresa)' })
  @ApiProduces('application/pdf')
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  async saldoPdf(
    @Query() query: PatioSaldoQueryDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const buf = await this.saldoRelatorio.pdf(query, user.tenantId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="saldo-unidades.pdf"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(buf);
  }

  @Get('saldo/xml')
  @ApiOperation({ summary: 'Relatório XML do saldo de unidades' })
  @ApiProduces('application/xml')
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  async saldoXml(
    @Query() query: PatioSaldoQueryDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const xml = await this.saldoRelatorio.xml(query, user.tenantId);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="saldo-unidades.xml"');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(xml);
  }

  @Get('unidade/:iso')
  @ApiOperation({ summary: 'Histórico completo da unidade ISO no pátio' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  unidade(@Param('iso') iso: string) {
    return this.patio.historicoUnidade(iso);
  }

  @Get('unidade/:iso/tomada')
  @ApiOperation({ summary: 'Status da tomada reefer da unidade no pátio' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  statusTomada(@Param('iso') iso: string) {
    return this.patio.statusTomada(iso);
  }

  @Post('unidade/:iso/tomada/conectar')
  @ApiOperation({ summary: 'Conectar tomada reefer pelo ISO (Gate / pátio)' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  conectarTomadaPorIso(
    @Param('iso') iso: string,
    @Body() dto: PatioTomadaConectarDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.patio.conectarTomadaPorIso(iso, user.id, dto);
  }

  @Post('unidade/:iso/tomada/desconectar')
  @ApiOperation({ summary: 'Desconectar tomada reefer pelo ISO (Gate / pátio)' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  desconectarTomadaPorIso(
    @Param('iso') iso: string,
    @Body() dto: PatioTomadaDesconectarDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.patio.desconectarTomadaPorIso(iso, user.id, dto);
  }

  @Post('unidades/:id/tomada/conectar')
  @ApiOperation({
    summary: 'Conectar tomada reefer (inicia cobrança de energia diária premium)',
  })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  conectarTomada(
    @Param('id') id: string,
    @Body() dto: PatioTomadaConectarDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.patio.conectarTomada(id, user.id, dto);
  }

  @Post('unidades/:id/tomada/desconectar')
  @ApiOperation({
    summary: 'Desconectar tomada reefer (encerra cobrança de energia)',
  })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  desconectarTomada(
    @Param('id') id: string,
    @Body() dto: PatioTomadaDesconectarDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.patio.desconectarTomada(id, user.id, dto);
  }
}
