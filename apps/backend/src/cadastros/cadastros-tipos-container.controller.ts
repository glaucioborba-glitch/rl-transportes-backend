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
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CadastrosTiposContainerService } from './cadastros-tipos-container.service';
import { CadastrosTipoContainerFormDto } from './dto/cadastros-tipo-container-form.dto';
import { CadastrosTipoContainerQueryDto } from './dto/cadastros-tipo-container-query.dto';

const TIPOS_CONTAINER_LEITURA_ROLES = [
  Role.ADMIN,
  Role.GERENTE,
  Role.SUPER_ADMIN,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_PATIO,
] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/tipos-container')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...TIPOS_CONTAINER_LEITURA_ROLES)
export class CadastrosTiposContainerController {
  constructor(private readonly service: CadastrosTiposContainerService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tipos de contêiner (catálogo global, só leitura no tenant)' })
  list(@Query() query: CadastrosTipoContainerQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do tipo de contêiner (catálogo global, só leitura no tenant)' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}

@ApiTags('super-admin')
@ApiBearerAuth('access-token')
@Controller('super-admin/tipos-container')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class CadastrosTiposContainerSuperAdminController {
  constructor(private readonly service: CadastrosTiposContainerService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tipos de contêiner (catálogo global)' })
  list(@Query() query: CadastrosTipoContainerQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.list(query, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do tipo de contêiner' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar tipo de contêiner (global, todos os terminais)' })
  create(@Body() dto: CadastrosTipoContainerFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar tipo de contêiner (global, todos os terminais)' })
  update(@Param('id') id: string, @Body() dto: CadastrosTipoContainerFormDto) {
    return this.service.update(id, dto);
  }
}
