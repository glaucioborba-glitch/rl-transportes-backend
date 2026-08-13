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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CadastrosPosicoesPatioService } from './cadastros-posicoes-patio.service';
import {
  CadastrosPosicaoPatioDisponiveisQueryDto,
  CadastrosPosicaoPatioFormDto,
} from './dto/cadastros-posicao-patio-form.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/posicoes-patio')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosPosicoesPatioController {
  constructor(private readonly service: CadastrosPosicoesPatioService) {}

  @Get('zonas')
  @ApiOperation({ summary: 'Listar zonas de pátio' })
  listZonas() {
    return this.service.listZonas();
  }

  @Get('disponiveis')
  @ApiOperation({ summary: 'Listar slots livres por tipo' })
  listDisponiveis(@Query() query: CadastrosPosicaoPatioDisponiveisQueryDto) {
    return this.service.listDisponiveis(query);
  }

  @Get()
  @ApiOperation({ summary: 'Listar posições de pátio' })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da posição' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar posição de pátio' })
  create(@Body() dto: CadastrosPosicaoPatioFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar posição de pátio' })
  update(@Param('id') id: string, @Body() dto: CadastrosPosicaoPatioFormDto) {
    return this.service.update(id, dto);
  }
}
