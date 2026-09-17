import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CadastroFinanceiroService } from './cadastro-financeiro.service';
import { AtualizarCondicaoClienteDto } from './dto/cadastro-financeiro.dto';

@ApiTags('cadastro-financeiro')
@ApiBearerAuth('access-token')
@Controller('financeiro/clientes-condicoes')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class FinanceiroClientesCondicoesController {
  constructor(private readonly cadastroFinanceiro: CadastroFinanceiroService) {}

  @Get('tabelas-precos')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('cadastro-financeiro:analisar')
  @ApiOperation({ summary: 'Tabelas cadastrais ativas para atribuir ao cliente' })
  tabelas() {
    return this.cadastroFinanceiro.listarTabelasPrecoAtribuicao();
  }

  @Get('tabelas-transporte')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('cadastro-financeiro:analisar')
  @ApiOperation({ summary: 'Tabelas de transportes vigentes para atribuir ao cliente' })
  tabelasTransporte() {
    return this.cadastroFinanceiro.listarTabelasTransporteAtribuicao();
  }

  @Get('tabelas-servicos')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('cadastro-financeiro:analisar')
  @ApiOperation({ summary: 'Tabelas de serviços ativas para atribuir ao cliente' })
  tabelasServicos() {
    return this.cadastroFinanceiro.listarTabelasServicoAtribuicao();
  }

  @Get('tabelas-aluguel')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('cadastro-financeiro:analisar')
  @ApiOperation({ summary: 'Tabelas de aluguel ativas para atribuir ao cliente' })
  tabelasAluguel() {
    return this.cadastroFinanceiro.listarTabelasAluguelAtribuicao();
  }

  @Get()
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('cadastro-financeiro:analisar')
  @ApiOperation({ summary: 'Listar clientes aprovados para alteração de forma, prazo e tabela' })
  listar(@Query('q') q?: string) {
    return this.cadastroFinanceiro.listarCondicoesClientes(q);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('cadastro-financeiro:analisar')
  @ApiOperation({ summary: 'Atualizar forma, prazo e tabelas comerciais do cliente' })
  atualizar(
    @Param('id') id: string,
    @Body() body: AtualizarCondicaoClienteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cadastroFinanceiro.atualizarCondicao(id, body, user.sub);
  }
}
