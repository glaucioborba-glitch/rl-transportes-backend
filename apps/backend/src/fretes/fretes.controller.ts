import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, StatusFrete } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateFreteDto, UpdateFreteDto } from './dto/frete.dto';
import { FretesService } from './fretes.service';

const FRETES_ROLES: Role[] = [Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE];

@ApiTags('fretes')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('v2/fretes')
export class FretesController {
  constructor(private readonly fretes: FretesService) {}

  @Get()
  @Roles(...FRETES_ROLES)
  @Permissions('dispatch:ler')
  @ApiOperation({ summary: 'Quadro de fretes (planilha operacional)' })
  listar(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: StatusFrete,
    @Query('q') q?: string,
  ) {
    return this.fretes.listar(user.tenantId || 'default', { from, to, status, q });
  }

  @Post()
  @Roles(...FRETES_ROLES)
  @Permissions('dispatch:operar')
  @ApiOperation({ summary: 'Incluir linha de frete (como na planilha)' })
  criar(@Body() dto: CreateFreteDto, @CurrentUser() user: AuthUser) {
    return this.fretes.criar(user.tenantId || 'default', dto, user.sub);
  }

  @Post('sincronizar')
  @Roles(...FRETES_ROLES)
  @Permissions('dispatch:operar')
  @ApiOperation({ summary: 'Gera linhas a partir de solicitações frota FL ainda sem frete' })
  sincronizar(@CurrentUser() user: AuthUser) {
    return this.fretes.sincronizarDeAgendamentos(user.tenantId || 'default', user.sub);
  }

  @Patch(':id')
  @Roles(...FRETES_ROLES)
  @Permissions('dispatch:operar')
  atualizar(@Param('id') id: string, @Body() dto: UpdateFreteDto, @CurrentUser() user: AuthUser) {
    return this.fretes.atualizar(id, user.tenantId || 'default', dto, user.sub);
  }
}
