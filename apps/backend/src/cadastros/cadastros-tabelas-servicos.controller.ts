import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CadastrosTabelasServicosService } from './cadastros-tabelas-servicos.service';
import {
  CadastrosServicoItemFormDto,
  CadastrosTabelaServicoFormDto,
} from './dto/cadastros-tabela-servico-form.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/tabelas-servicos')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosTabelasServicosController {
  constructor(private readonly service: CadastrosTabelasServicosService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get('catalogo')
  catalogo() {
    return this.service.listCatalogoAtivo();
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
  create(@Body() dto: CadastrosTabelaServicoFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CadastrosTabelaServicoFormDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/itens')
  @HttpCode(HttpStatus.CREATED)
  createItem(@Param('id') id: string, @Body() dto: CadastrosServicoItemFormDto) {
    return this.service.createItem(id, dto);
  }

  @Put(':id/itens/:itemId')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: CadastrosServicoItemFormDto,
  ) {
    return this.service.updateItem(id, itemId, dto);
  }
}
