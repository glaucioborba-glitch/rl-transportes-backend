import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RelatorioListaQueryDto } from './dto/relatorio-lista-query.dto';
import { RelatorioQueryDto } from './dto/relatorio-query.dto';
import { RelatoriosService } from './relatorios.service';

@ApiTags('relatorios')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatorios: RelatoriosService) {}

  @Get('operacional/solicitacoes')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('relatorios:operacional')
  resumoSolicitacoes(@Query() q: RelatorioQueryDto, @CurrentUser() user: AuthUser) {
    return this.relatorios.resumoSolicitacoes(q.dataInicio, q.dataFim, user);
  }

  @Get('financeiro/faturamento')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('relatorios:financeiro')
  resumoFinanceiro(@Query() q: RelatorioQueryDto, @CurrentUser() user: AuthUser) {
    return this.relatorios.resumoFinanceiro(q.dataInicio, q.dataFim, user, q.clienteId);
  }

  @Get('operacional/solicitacoes/lista')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('relatorios:operacional')
  listaSolicitacoes(@Query() q: RelatorioListaQueryDto, @CurrentUser() user: AuthUser) {
    return this.relatorios.listaSolicitacoes(
      {
        dataInicio: q.dataInicio,
        dataFim: q.dataFim,
        page: q.page ?? 1,
        limit: q.limit ?? 50,
        clienteId: q.clienteId,
        status: q.status,
      },
      user,
    );
  }

  @Get('financeiro/faturamento/lista')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('relatorios:financeiro')
  listaFaturamentos(@Query() q: RelatorioListaQueryDto, @CurrentUser() user: AuthUser) {
    return this.relatorios.listaFaturamentos(
      {
        dataInicio: q.dataInicio,
        dataFim: q.dataFim,
        page: q.page ?? 1,
        limit: q.limit ?? 50,
        clienteId: q.clienteId,
      },
      user,
    );
  }
}
