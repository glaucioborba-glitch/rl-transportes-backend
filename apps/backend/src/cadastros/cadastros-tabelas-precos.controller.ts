import {
  Body,
  Controller,
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CadastrosTabelasPrecosService } from './cadastros-tabelas-precos.service';
import { CadastrosTabelaPrecoFormDto } from './dto/cadastros-tabela-preco-form.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/tabelas-precos')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosTabelasPrecosController {
  constructor(private readonly service: CadastrosTabelasPrecosService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get('matriz/combinacoes')
  gerarMatriz() {
    return this.service.gerarMatrizCombinacoes();
  }

  @Get('vigente')
  findVigente(
    @Query('clienteId') clienteId?: string,
    @Query('tipoOperacao') tipoOperacao?: string,
    @Query('tipoContainer') tipoContainer?: string,
    @Query('tamanho') tamanho?: string,
  ) {
    return this.service.findVigente({ clienteId, tipoOperacao, tipoContainer, tamanho });
  }

  @Get(':id/itens')
  listItens(@Param('id') id: string) {
    return this.service.listItens(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CadastrosTabelaPrecoFormDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CadastrosTabelaPrecoFormDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user.id);
  }

  @Post(':id/sync')
  @HttpCode(HttpStatus.OK)
  sync(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.syncBilling(id, user.id);
  }
}
