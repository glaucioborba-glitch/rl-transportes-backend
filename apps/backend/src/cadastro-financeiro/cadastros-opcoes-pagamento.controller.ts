import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, TipoOpcaoPagamento } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CondicaoPagamentoService } from './condicao-pagamento.service';
import { AtualizarOpcaoPagamentoDto, CriarOpcaoPagamentoDto } from './dto/opcao-pagamento.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/opcoes-pagamento')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosOpcoesPagamentoController {
  constructor(private readonly opcoes: CondicaoPagamentoService) {}

  @Get()
  @ApiOperation({ summary: 'Listar catálogo de forma de pagamento ou prazo' })
  listar(@Query('tipo') tipo: TipoOpcaoPagamento = TipoOpcaoPagamento.FORMA) {
    const resolved = tipo === TipoOpcaoPagamento.PRAZO ? TipoOpcaoPagamento.PRAZO : TipoOpcaoPagamento.FORMA;
    return this.opcoes.listarCatalogo(resolved);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar opção de forma ou prazo' })
  criar(@Body() dto: CriarOpcaoPagamentoDto) {
    return this.opcoes.criar(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Alterar nome ou status da opção' })
  atualizar(@Param('id') id: string, @Body() dto: AtualizarOpcaoPagamentoDto) {
    return this.opcoes.atualizar(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir opção (somente se nenhum cliente a utilizar)' })
  async excluir(@Param('id') id: string): Promise<void> {
    await this.opcoes.excluir(id);
  }
}
