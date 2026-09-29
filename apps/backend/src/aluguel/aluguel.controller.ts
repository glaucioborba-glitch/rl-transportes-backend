import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, StatusSolicitacaoAluguel } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AluguelService } from './aluguel.service';
import { IniciarAluguelDto } from './dto/aluguel.dto';
import { RejeitarSolicitacaoAluguelDto } from './dto/solicitacao-aluguel.dto';
import { SolicitacaoAluguelService } from './solicitacao-aluguel.service';

const OPS_ROLES = [Role.ADMIN, Role.GERENTE, Role.OPERADOR_PATIO, Role.OPERADOR_GATE] as const;

@ApiTags('aluguel')
@ApiBearerAuth('access-token')
@Controller('v2/alugueis')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...OPS_ROLES)
export class AluguelController {
  constructor(
    private readonly service: AluguelService,
    private readonly solicitacoes: SolicitacaoAluguelService,
  ) {}

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

  @Get('reservas')
  listarReservas() {
    return this.solicitacoes.listarReservasPatio();
  }

  @Get('motivos-rejeicao')
  listarMotivosRejeicaoAluguel() {
    return this.solicitacoes.listarMotivosRejeicao();
  }

  @Get('solicitacoes')
  listarSolicitacoes(@Query('status') status?: string) {
    const allowed = Object.values(StatusSolicitacaoAluguel) as string[];
    const filtro = status && allowed.includes(status) ? (status as StatusSolicitacaoAluguel) : undefined;
    return this.solicitacoes.listarStaff(filtro);
  }

  @Get('solicitacoes/:id')
  obterSolicitacao(@Param('id') id: string) {
    return this.solicitacoes.obterStaff(id);
  }

  @Post('solicitacoes/:id/aprovar')
  @Roles(Role.ADMIN, Role.GERENTE)
  aprovarSolicitacao(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.solicitacoes.aprovarStaff(id, user.id);
  }

  @Post('solicitacoes/:id/rejeitar')
  @Roles(Role.ADMIN, Role.GERENTE)
  rejeitarSolicitacao(
    @Param('id') id: string,
    @Body() dto: RejeitarSolicitacaoAluguelDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.solicitacoes.rejeitarStaff(id, user.id, dto.motivo);
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
