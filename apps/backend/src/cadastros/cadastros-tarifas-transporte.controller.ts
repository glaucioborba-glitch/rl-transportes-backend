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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CadastrosTarifasTransporteService } from './cadastros-tarifas-transporte.service';
import { CadastrosTarifaTransporteFormDto } from './dto/cadastros-tarifa-transporte-form.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/tarifas-transporte')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosTarifasTransporteController {
  constructor(private readonly service: CadastrosTarifasTransporteService) {}

  @Get()
  list(@Query('tabelaId') tabelaId?: string, @Query('search') search?: string) {
    return this.service.list(tabelaId, search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CadastrosTarifaTransporteFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CadastrosTarifaTransporteFormDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
