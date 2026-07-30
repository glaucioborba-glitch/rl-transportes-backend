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
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import {
  CadastrosMotivosRejeicaoService,
  CadastrosTurnosService,
} from './cadastros-turnos-motivos.service';
import {
  CadastrosMotivoRejeicaoFormDto,
  CadastrosMotivoRejeicaoQueryDto,
  CadastrosTurnoFormDto,
} from './dto/cadastros-turno-motivo-form.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/turnos')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosTurnosController {
  constructor(private readonly service: CadastrosTurnosService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CadastrosTurnoFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CadastrosTurnoFormDto) {
    return this.service.update(id, dto);
  }
}

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/motivos-rejeicao')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosMotivosRejeicaoController {
  constructor(private readonly service: CadastrosMotivosRejeicaoService) {}

  @Get()
  list(@Query() query: CadastrosMotivoRejeicaoQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CadastrosMotivoRejeicaoFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CadastrosMotivoRejeicaoFormDto) {
    return this.service.update(id, dto);
  }
}
