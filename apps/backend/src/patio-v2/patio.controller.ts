import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PatioMovimentarDto } from './dto/movimentar.dto';
import { PatioPosicionarDto, PatioPrepararGateOutDto } from './dto/posicionar.dto';
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
  constructor(private readonly patio: PatioV2Service) {}

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
  @ApiOperation({ summary: 'Inventário em tempo real — baias, lotação, divergências' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  inventario() {
    return this.patio.inventario();
  }

  @Get('unidade/:iso')
  @ApiOperation({ summary: 'Histórico completo da unidade ISO no pátio' })
  @Roles(...PATIO_ROLES)
  @Permissions('solicitacoes:patio')
  unidade(@Param('iso') iso: string) {
    return this.patio.historicoUnidade(iso);
  }
}
