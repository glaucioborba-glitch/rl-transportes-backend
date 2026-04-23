import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SolicitacaoPaginationDto } from '../common/dtos/pagination.dto';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { FaturamentoQueryDto } from '../faturamento/dto/faturamento-query.dto';
import { PortalBoletosQueryDto } from '../faturamento/dto/portal-boletos-query.dto';
import { FaturamentoService } from '../faturamento/faturamento.service';
import { SolicitacoesService } from '../solicitacoes/solicitacoes.service';

/** Rotas explícitas do portal do cliente (escopo próprio). */
@ApiTags('portal-cliente')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(Role.CLIENTE)
@Controller('portal')
export class PortalController {
  constructor(
    private readonly solicitacoes: SolicitacoesService,
    private readonly faturamento: FaturamentoService,
  ) {}

  @Get('solicitacoes')
  @Permissions('solicitacoes:ler')
  @ApiOperation({ summary: 'Lista solicitações do próprio cliente' })
  listarSolicitacoes(@Query() query: SolicitacaoPaginationDto, @CurrentUser() user: AuthUser) {
    return this.solicitacoes.findAllPaginated(
      query,
      { status: query.status },
      user,
    );
  }

  @Get('solicitacoes/:id')
  @Permissions('solicitacoes:ler')
  obterSolicitacao(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.solicitacoes.findOne(id, user);
  }

  @Patch('solicitacoes/:id/aprovar')
  @Permissions('portal:solicitacao:aprovar')
  @ApiOperation({ summary: 'Aprova solicitação pendente (próprio cliente)' })
  aprovar(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.solicitacoes.aprovarPeloCliente(id, user);
  }

  @Get('faturamento')
  @Permissions('faturamento:ler')
  listarFaturamento(@Query() query: FaturamentoQueryDto, @CurrentUser() user: AuthUser) {
    return this.faturamento.findAll(query, user);
  }

  @Get('faturamento/:id')
  @Permissions('faturamento:ler')
  obterFaturamento(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.faturamento.findOne(id, user);
  }

  @Get('boletos')
  @Permissions('faturamento:ler')
  @ApiOperation({ summary: 'Boletos do cliente (paginado, acompanhamento)' })
  listarBoletos(@Query() query: PortalBoletosQueryDto, @CurrentUser() user: AuthUser) {
    return this.faturamento.listBoletosPortal(query, user);
  }
}
