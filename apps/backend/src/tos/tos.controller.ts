import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ContainerLifecycleService } from './container-lifecycle.service';
import { AprovarReparoDto } from './dto/aprovar-reparo.dto';
import { CreateContainerDto } from './dto/create-container.dto';
import { ReeferLogDto } from './dto/reefer-log.dto';
import { TransitionStateDto } from './dto/transition-state.dto';
import { RepairApprovalAuthGuard } from './guards/repair-approval-auth.guard';

const TOS_STAFF_ROLES: Role[] = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
  Role.OPERADOR_PORTARIA,
];

@ApiTags('tos')
@Controller()
export class TosController {
  constructor(private readonly lifecycle: ContainerLifecycleService) {}

  @Post('v2/tos/containers')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(...TOS_STAFF_ROLES)
  @Permissions('solicitacoes:gate')
  @ApiOperation({ summary: 'Cria contêiner TOS e emite evento SCHEDULED' })
  criarContainer(@Body() dto: CreateContainerDto, @CurrentUser() user: AuthUser) {
    return this.lifecycle.createContainer(dto, user.sub);
  }

  @Get('v2/tos/containers/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(...TOS_STAFF_ROLES)
  @Permissions('solicitacoes:ler')
  @ApiOperation({ summary: 'Detalhe do contêiner com replay de eventos e estado FSM' })
  obterContainer(@Param('id') id: string) {
    return this.lifecycle.getContainerWithEvents(id);
  }

  @Post('v2/tos/containers/:id/transition')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(...TOS_STAFF_ROLES)
  @Permissions('solicitacoes:gate')
  @ApiOperation({ summary: 'Transição de estado via Event Sourcing (FSM)' })
  transicionar(
    @Param('id') id: string,
    @Body() dto: TransitionStateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lifecycle.transitionState(id, dto.eventType, dto.payload ?? {}, user.sub);
  }

  @Post('containers/:id/reefer/log')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(...TOS_STAFF_ROLES)
  @Permissions('solicitacoes:patio')
  @ApiOperation({ summary: 'Registra temperatura reefer; alerta se Δ > 2°C do setPoint' })
  logReefer(
    @Param('id') id: string,
    @Body() dto: ReeferLogDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lifecycle.logReeferTemperature(id, dto.temperaturaAtual, user.sub);
  }

  @Post('containers/:id/reparos/aprovar')
  @ApiBearerAuth('access-token')
  @UseGuards(RepairApprovalAuthGuard)
  @ApiOperation({
    summary: 'Aprova reparo (dual-auth: portal cliente ou staff intranet)',
  })
  async aprovarReparo(
    @Param('id') id: string,
    @Body() dto: AprovarReparoDto,
    @Req() req: Request & { repairApprovalActor?: { userId: string; origem: 'CLIENTE_PORTAL' | 'STAFF_INTRANET'; clienteId?: string } },
  ) {
    const actor = req.repairApprovalActor;
    if (!actor) {
      throw new ForbiddenException('Contexto de autenticação ausente.');
    }

    if (actor.origem === 'CLIENTE_PORTAL' && actor.clienteId) {
      const container = await this.lifecycle.getContainerWithEvents(id);
      if (container.clienteId !== actor.clienteId) {
        throw new ForbiddenException('Contêiner não pertence ao cliente autenticado.');
      }
    }

    return this.lifecycle.aprovarReparo(
      id,
      {
        origem: actor.origem,
        observacao: dto.observacao,
        valorReparo: dto.valorReparo,
      },
      actor.userId,
    );
  }
}
