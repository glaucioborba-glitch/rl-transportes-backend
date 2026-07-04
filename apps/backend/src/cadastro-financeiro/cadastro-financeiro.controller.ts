import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CadastroFinanceiroService } from './cadastro-financeiro.service';
import {
  AprovarCadastroFinanceiroDto,
  RejeitarCadastroFinanceiroDto,
} from './dto/cadastro-financeiro.dto';

@ApiTags('cadastro-financeiro')
@ApiBearerAuth('access-token')
@Controller('financeiro/cadastros-pendentes')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class CadastroFinanceiroController {
  constructor(private readonly cadastroFinanceiro: CadastroFinanceiroService) {}

  @Get()
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('cadastro-financeiro:analisar')
  @ApiOperation({ summary: 'Listar novos cadastros portal pendentes de análise financeira' })
  listar() {
    return this.cadastroFinanceiro.listarPendentes();
  }

  @Post(':id/aprovar')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('cadastro-financeiro:analisar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprovar cadastro e definir condição de pagamento' })
  aprovar(
    @Param('id') id: string,
    @Body() body: AprovarCadastroFinanceiroDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cadastroFinanceiro.aprovar(id, body.condicaoPagamento, user.sub);
  }

  @Post(':id/rejeitar')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('cadastro-financeiro:analisar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeitar cadastro portal (motivo obrigatório)' })
  rejeitar(
    @Param('id') id: string,
    @Body() body: RejeitarCadastroFinanceiroDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cadastroFinanceiro.rejeitar(id, body.motivo, user.sub);
  }
}
