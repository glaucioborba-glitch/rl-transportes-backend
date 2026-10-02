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
import { CadastrosCapacidadesContainerService } from './cadastros-capacidades-container.service';
import { CadastrosCapacidadeContainerFormDto } from './dto/cadastros-capacidade-container-form.dto';
import { CadastrosCapacidadeContainerQueryDto } from './dto/cadastros-capacidade-container-query.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/capacidades-container')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosCapacidadesContainerController {
  constructor(private readonly service: CadastrosCapacidadesContainerService) {}

  @Get()
  @ApiOperation({ summary: 'Listar capacidades de contêiner (HC, DC…)' })
  list(@Query() query: CadastrosCapacidadeContainerQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe da capacidade' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar capacidade' })
  create(@Body() dto: CadastrosCapacidadeContainerFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar capacidade' })
  update(@Param('id') id: string, @Body() dto: CadastrosCapacidadeContainerFormDto) {
    return this.service.update(id, dto);
  }
}
