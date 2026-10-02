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
import { CadastrosLocaisTransporteService } from './cadastros-locais-transporte.service';
import { CadastrosLocalTransporteFormDto } from './dto/cadastros-local-transporte-form.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/locais-transporte')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosLocaisTransporteController {
  constructor(private readonly service: CadastrosLocaisTransporteService) {}

  @Get()
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  list(@Query('search') search?: string) {
    return this.service.list(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CadastrosLocalTransporteFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CadastrosLocalTransporteFormDto) {
    return this.service.update(id, dto);
  }
}
