import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AluguelService } from './aluguel.service';
import { IniciarAluguelDto } from './dto/aluguel.dto';

const OPS_ROLES = [Role.ADMIN, Role.GERENTE, Role.OPERADOR_PATIO, Role.OPERADOR_GATE] as const;

@ApiTags('aluguel')
@ApiBearerAuth('access-token')
@Controller('v2/alugueis')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...OPS_ROLES)
export class AluguelController {
  constructor(private readonly service: AluguelService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.service.list(status);
  }

  @Get('frota')
  frota() {
    return this.service.listFrota();
  }

  @Get('clientes')
  clientes() {
    return this.service.listClientes();
  }

  @Post()
  iniciar(@Body() dto: IniciarAluguelDto, @CurrentUser() user: AuthUser) {
    return this.service.iniciar(dto, user.id);
  }

  @Post(':id/devolver')
  devolver(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.devolver(id, user.id);
  }
}
