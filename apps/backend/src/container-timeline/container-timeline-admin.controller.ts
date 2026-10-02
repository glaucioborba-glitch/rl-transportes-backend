import { BadRequestException, Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ContainerTimelineService } from './container-timeline.service';
import type { ContainerRicTipo } from './container-timeline.types';
import { Iso6346ParamPipe } from './iso6346-param.pipe';

const ADMIN_ROLES: Role[] = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
];

@ApiTags('Container Timeline (Admin)')
@ApiBearerAuth()
@Controller('admin/container')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class ContainerTimelineAdminController {
  constructor(private readonly timeline: ContainerTimelineService) {}

  @Get(':iso/timeline')
  @ApiOperation({ summary: 'Dossiê 360º do contêiner (intranet)' })
  @Roles(...ADMIN_ROLES)
  @Permissions('solicitacoes:ler')
  adminTimeline(@Param('iso', Iso6346ParamPipe) iso: string) {
    return this.timeline.getAdminTimeline(iso);
  }

  @Get(':iso/ric/:tipo')
  @ApiOperation({ summary: 'Payload RIC (entrada/saída) para reimpressão PDF' })
  @Roles(...ADMIN_ROLES)
  @Permissions('solicitacoes:ler')
  adminRic(@Param('iso', Iso6346ParamPipe) iso: string, @Param('tipo') tipo: string) {
    const t = tipo.toUpperCase();
    if (t !== 'ENTRADA' && t !== 'SAIDA') {
      throw new BadRequestException('tipo deve ser ENTRADA ou SAIDA');
    }
    return this.timeline.getRicPayload(iso, t as ContainerRicTipo);
  }
}
