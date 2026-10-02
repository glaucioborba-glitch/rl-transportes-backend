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
import { CadastrosPlanoContasService } from './cadastros-plano-contas.service';
import { CadastrosPlanoContasFormDto } from './dto/cadastros-plano-contas-form.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/plano-contas')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosPlanoContasController {
  constructor(private readonly service: CadastrosPlanoContasService) {}

  @Get()
  list(@Query('tipo') tipo?: string) {
    return this.service.list(tipo);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CadastrosPlanoContasFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CadastrosPlanoContasFormDto) {
    return this.service.update(id, dto);
  }
}
