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

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/tipos-container')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosTiposContainerController {
  constructor(private readonly service: CadastrosTiposContainerService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tipos de contêiner' })
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
  @ApiOperation({ summary: 'Criar tipo de contêiner' })
  create(@Body() dto: CadastrosTipoContainerFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar tipo de contêiner' })
  update(@Param('id') id: string, @Body() dto: CadastrosTipoContainerFormDto) {
    return this.service.update(id, dto);
  }
}
