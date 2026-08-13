import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { OperacionalVinculoService } from './operacional-vinculo.service';
import { VincularEquipamentoDto } from './dto/cadastros-equipamento-form.dto';

const OPERACIONAL_ROLES = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_PATIO,
] as const;

@ApiTags('operacional')
@ApiBearerAuth('access-token')
@Controller('v2/operacional')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...OPERACIONAL_ROLES)
export class OperacionalVinculoController {
  constructor(private readonly service: OperacionalVinculoService) {}

  @Post('vincular-equipamento')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vincular equipamento ao operador (login)' })
  vincular(
    @Body() dto: VincularEquipamentoDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.service.vincularEquipamento(req.user.sub, dto);
  }

  @Post('desvincular-equipamento')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desvincular equipamento (logout)' })
  desvincular(@Request() req: { user: { sub: string } }) {
    return this.service.desvincularEquipamento(req.user.sub);
  }

  @Get('equipamento-atual/:userId')
  @ApiOperation({ summary: 'Equipamento em uso pelo operador' })
  equipamentoAtual(@Param('userId') userId: string, @CurrentUser() user: AuthUser) {
    const target = user.role === Role.ADMIN || user.role === Role.GERENTE ? userId : user.sub;
    return this.service.equipamentoAtual(target);
  }
}
