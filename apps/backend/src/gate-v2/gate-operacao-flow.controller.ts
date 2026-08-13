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
import { GateOperacaoFlowService } from './gate-operacao-flow.service';

const GATE_ROLES: Role[] = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
];

@ApiTags('gate-operacao-flow')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('v2/gate')
export class GateOperacaoFlowController {
  constructor(private readonly flow: GateOperacaoFlowService) {}

  @Get('aguardando-chegada')
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  aguardandoChegada(@Query('search') search?: string) {
    return this.flow.listAguardandoChegada(search);
  }

  @Get('portaria/stats')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA)
  @Permissions('solicitacoes:ler')
  portariaStats() {
    return this.flow.portariaStats();
  }

  @Get('reconfirmacoes')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:ler')
  reconfirmacoes() {
    return this.flow.listAguardandoReconfirmacao();
  }

  @Get('reconfirmacoes/count')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:ler')
  reconfirmacoesCount() {
    return this.flow.countAguardandoReconfirmacao().then((count) => ({ count }));
  }

  @Get('qr/:token/validate')
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  @ApiOperation({ summary: 'Validar QR token na portaria' })
  validateQr(@Param('token') token: string) {
    return this.flow.validateQrToken(token);
  }

  @Get('operacoes/:protocolo')
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  getOperacao(@Param('protocolo') protocolo: string) {
    return this.flow.getOperacao(protocolo);
  }

  @Post('operacoes/:protocolo/checkin')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA)
  @Permissions('solicitacoes:portaria')
  checkin(@Param('protocolo') protocolo: string, @CurrentUser() user: AuthUser) {
    return this.flow.checkin(protocolo, user.id);
  }

  @Post('operacoes/:protocolo/vistoria')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA)
  @Permissions('solicitacoes:portaria')
  vistoria(
    @Param('protocolo') protocolo: string,
    @Body()
    body: {
      fotos: Array<{ tipo: string; imagem: string; ocrResult?: string; ocrMatch?: boolean; ocrConfianca?: number; ocrProvider?: string }>;
      avarias: Array<{ foto: string; descricao: string; localizacao: string }>;
    },
    @CurrentUser() user: AuthUser,
  ) {
    return this.flow.submitVistoria(protocolo, body, user.id);
  }

  @Get('operacoes/:protocolo/vistoria')
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  getVistoria(@Param('protocolo') protocolo: string) {
    return this.flow.getVistoria(protocolo);
  }

  @Post('operacoes/:protocolo/reconfirmar')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:gate')
  reconfirmar(
    @Param('protocolo') protocolo: string,
    @Body() body: { checklist: Record<string, boolean> },
    @CurrentUser() user: AuthUser,
  ) {
    return this.flow.reconfirmar(protocolo, body.checklist, user.id);
  }

  @Post('operacoes/:protocolo/rejeitar')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:gate')
  rejeitar(
    @Param('protocolo') protocolo: string,
    @Body() body: { motivo: string; etapa: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.flow.rejeitar(protocolo, body.motivo, body.etapa, user.id);
  }

  @Post('operacoes/:protocolo/assinatura')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:gate')
  assinatura(
    @Param('protocolo') protocolo: string,
    @Body() body: { assinatura: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.flow.saveAssinatura(protocolo, body.assinatura, user.id);
  }

  @Post('operacoes/:protocolo/ric-pdf')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:gate')
  @ApiOperation({ summary: 'Gerar RIC (Relatório de Inspeção de Contêiner) em PDF' })
  @ApiProduces('application/pdf')
  async ricPdf(@Param('protocolo') protocolo: string, @Res() res: Response) {
    const pdfStream = await this.flow.streamRicPdf(protocolo);
    const safeName = protocolo.replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RIC-${safeName}.pdf"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    pdfStream.pipe(res);
  }

  @Post('operacoes/:protocolo/liberar-operacao')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:gate')
  liberar(@Param('protocolo') protocolo: string, @CurrentUser() user: AuthUser) {
    return this.flow.liberarOperacao(protocolo, user.id);
  }

  @Post('operacoes/:protocolo/iniciar')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PATIO, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:patio')
  iniciar(
    @Param('protocolo') protocolo: string,
    @Body() body: { equipamentoId?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.flow.iniciarOperacao(protocolo, body.equipamentoId, user.id);
  }

  @Post('operacoes/:protocolo/concluir')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PATIO, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:patio')
  concluir(@Param('protocolo') protocolo: string, @CurrentUser() user: AuthUser) {
    return this.flow.concluirOperacao(protocolo, user.id);
  }
}
