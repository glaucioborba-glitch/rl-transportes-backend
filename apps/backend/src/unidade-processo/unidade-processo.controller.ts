import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { UnidadeProcessoServicosService } from './unidade-processo-servicos.service';

const STAFF_ROLES = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
] as const;

class LancarServicoDto {
  @IsUUID()
  servicoItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantidade!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lacre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  origemLacre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  isoDestino?: string;
}

@ApiTags('unidade-processo')
@ApiBearerAuth('access-token')
@Controller('v2/unidade-processos')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...STAFF_ROLES)
export class UnidadeProcessoController {
  constructor(private readonly servicos: UnidadeProcessoServicosService) {}

  @Get('catalogo-servicos')
  catalogo() {
    return this.servicos.catalogo();
  }

  @Get(':id/servicos')
  listar(@Param('id') id: string) {
    return this.servicos.listar(id);
  }

  @Post(':id/servicos')
  @HttpCode(HttpStatus.CREATED)
  lancar(@Param('id') id: string, @Body() dto: LancarServicoDto, @CurrentUser() user: AuthUser) {
    return this.servicos.lancar(id, dto, user.id);
  }

  @Delete(':id/servicos/:lancamentoId')
  remover(@Param('id') id: string, @Param('lancamentoId') lancamentoId: string) {
    return this.servicos.remover(id, lancamentoId);
  }
}
