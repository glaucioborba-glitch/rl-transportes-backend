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
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CadastrosPosicoesPatioService } from './cadastros-posicoes-patio.service';
import {
  CadastrosPosicaoPatioDisponiveisQueryDto,
  CadastrosPosicaoPatioFormDto,
  CadastrosZonaPatioFormDto,
} from './dto/cadastros-posicao-patio-form.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE, Role.SUPER_ADMIN] as const;

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

  @Post('zonas')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastrar zona de pátio (e, se pedido, as 12 posições)' })
  createZona(@Body() dto: CadastrosZonaPatioFormDto) {
    return this.service.createZona(dto);
  }

  @Put('zonas/:id')
  @ApiOperation({ summary: 'Editar zona de pátio' })
  updateZona(@Param('id') id: string, @Body() dto: CadastrosZonaPatioFormDto) {
    return this.service.updateZona(id, dto);
  }

  @Delete('zonas/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir zona de pátio e as posições dela' })
  removeZona(@Param('id') id: string) {
    return this.service.removeZona(id);
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

  @Post('grade-padrao')
  @ApiOperation({ summary: 'Gera as zonas A/B/C com 12 posições (4×3) e arquiva o formato antigo' })
  gradePadrao() {
    return this.service.ensureGradePadrao();
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Excluir posição de pátio' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
