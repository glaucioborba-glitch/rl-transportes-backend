import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ContaCorrenteService } from './conta-corrente.service';
import { ContaCorrenteQueryDto } from './dto/conta-corrente-query.dto';
import {
  CompensarContaCorrenteDto,
  CriarLancamentoContaCorrenteDto,
} from './dto/criar-lancamento-conta-corrente.dto';

@ApiTags('conta-corrente')
@ApiBearerAuth('access-token')
@Controller('v2/financeiro/conta-corrente')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class ContaCorrenteController {
  constructor(private readonly service: ContaCorrenteService) {}

  @Get()
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:ler')
  @ApiOperation({ summary: 'Listar saldo da conta corrente por cliente' })
  listar(@Query() query: ContaCorrenteQueryDto) {
    return this.service.listar(query);
  }

  @Get(':clienteId')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:ler')
  obter(@Param('clienteId') clienteId: string) {
    return this.service.obter(clienteId);
  }

  @Post(':clienteId/lancamentos')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:criar')
  lancar(
    @Param('clienteId') clienteId: string,
    @Body() dto: CriarLancamentoContaCorrenteDto,
    @CurrentUser() user: AuthUser,
    @Request() req: { ip?: string; get: (h: string) => string | undefined },
  ) {
    return this.service.lancar(
      clienteId,
      dto,
      user,
      req.ip || 'unknown',
      req.get('user-agent') || 'unknown',
    );
  }

  @Post(':clienteId/compensar')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:criar')
  compensar(
    @Param('clienteId') clienteId: string,
    @Body() dto: CompensarContaCorrenteDto,
    @CurrentUser() user: AuthUser,
    @Request() req: { ip?: string; get: (h: string) => string | undefined },
  ) {
    return this.service.compensar(
      clienteId,
      dto,
      user,
      req.ip || 'unknown',
      req.get('user-agent') || 'unknown',
    );
  }
}
