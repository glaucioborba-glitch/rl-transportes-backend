import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CadastrosContainerCacheService } from './cadastros-container-cache.service';
import { CadastrosContainerCacheCreateDto } from './dto/cadastros-tipo-container-form.dto';

const CADASTROS_ROLES = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_PATIO,
] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/container-cache')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosContainerCacheController {
  constructor(private readonly service: CadastrosContainerCacheService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Criar cache de contêiner (automático)' })
  create(@Body() dto: CadastrosContainerCacheCreateDto) {
    return this.service.ensure(dto);
  }

  @Get(':numero/historico')
  @ApiOperation({ summary: 'Histórico completo de passagens do contêiner' })
  historico(@Param('numero') numero: string) {
    return this.service.getHistorico(numero);
  }

  @Get(':numero')
  @ApiOperation({ summary: 'Buscar cache por número ISO' })
  findOne(@Param('numero') numero: string) {
    return this.service.findByNumero(numero);
  }
}
