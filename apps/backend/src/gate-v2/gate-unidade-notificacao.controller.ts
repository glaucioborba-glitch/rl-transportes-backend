import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { GateUnidadeNotificacaoService } from './gate-unidade-notificacao.service';

const GATE_ROLES: Role[] = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
];

@ApiTags('gate-notificacoes')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('v2/gate/notificacoes')
export class GateUnidadeNotificacaoController {
  constructor(private readonly notificacoes: GateUnidadeNotificacaoService) {}

  @Get()
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  @ApiOperation({ summary: 'Alterações na unidade após a criação do ID' })
  listar(@CurrentUser() user: AuthUser) {
    return this.notificacoes.listar(user.tenantId ?? 'default', user.id || user.sub);
  }

  @Get('nao-lidas')
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  @ApiOperation({ summary: 'Contagem de notificações do Gate não lidas' })
  naoLidas(@CurrentUser() user: AuthUser) {
    return this.notificacoes.contarNaoLidas(user.tenantId ?? 'default', user.id || user.sub);
  }

  @Post('marcar-todas-lidas')
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  marcarTodas(@CurrentUser() user: AuthUser) {
    return this.notificacoes.marcarTodasLidas(user.tenantId ?? 'default', user.id || user.sub);
  }

  @Post(':id/lida')
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  marcarLida(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notificacoes.marcarLida(user.tenantId ?? 'default', user.id || user.sub, id);
  }
}
