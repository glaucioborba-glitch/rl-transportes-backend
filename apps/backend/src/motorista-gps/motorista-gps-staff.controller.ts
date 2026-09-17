import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { MotoristaGpsService } from './motorista-gps.service';

@ApiTags('motorista-localizacao')
@ApiBearerAuth('access-token')
@Controller('v2/motorista-localizacao')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
export class MotoristaGpsStaffController {
  constructor(private readonly service: MotoristaGpsService) {}

  @Get()
  @ApiOperation({ summary: 'Mapa da frota — internos, terceiros e destinos cadastrados' })
  listar(@Query('destinoId') destinoId?: string) {
    return this.service.listarMapa(destinoId);
  }
}
