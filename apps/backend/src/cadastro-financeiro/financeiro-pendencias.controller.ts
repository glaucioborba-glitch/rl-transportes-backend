import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CadastroFinanceiroService } from './cadastro-financeiro.service';

@ApiTags('cadastro-financeiro')
@ApiBearerAuth('access-token')
@Controller('financeiro')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class FinanceiroPendenciasController {
  constructor(private readonly cadastroFinanceiro: CadastroFinanceiroService) {}

  @Get('pendencias-count')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('cadastro-financeiro:analisar')
  @ApiOperation({ summary: 'Quantidade de cadastros portal pendentes de análise financeira' })
  contarPendentes() {
    return this.cadastroFinanceiro.contarPendentes();
  }
}
