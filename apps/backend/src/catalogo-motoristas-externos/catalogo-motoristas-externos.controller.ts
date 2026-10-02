import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CatalogoMotoristasExternosService } from './catalogo-motoristas-externos.service';
import { LiberarMotoristaExternoDto } from './dto/liberar-motorista-externo.dto';
import { SuspenderMotoristaExternoDto } from './dto/suspender-motorista-externo.dto';

const GESTAO = [Role.ADMIN, Role.GERENTE, Role.SUPER_ADMIN] as const;
const CONSULTA = [
  Role.ADMIN,
  Role.GERENTE,
  Role.SUPER_ADMIN,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_PATIO,
] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/motoristas-externos')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class CatalogoMotoristasExternosController {
  constructor(private readonly service: CatalogoMotoristasExternosService) {}

  @Get()
  @Roles(...GESTAO)
  @ApiOperation({ summary: 'Listar motoristas externos deste terminal' })
  list(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
  ) {
    return this.service.listar({
      search,
      status,
      page: page ? Number(page) : 1,
    });
  }

  @Get('cpf/:cpf')
  @Roles(...CONSULTA)
  @Permissions('solicitacoes:ler')
  @ApiOperation({ summary: 'Lookup por CPF para autofill (somente deste tenant)' })
  buscar(@Param('cpf') cpf: string) {
    return this.service.buscarPorCpf(cpf);
  }

  @Patch(':id/suspender')
  @Roles(...GESTAO)
  @ApiOperation({ summary: 'Incluir motorista na Black List (autorização gerencial)' })
  suspender(@Param('id') id: string, @Body() dto: SuspenderMotoristaExternoDto) {
    return this.service.suspender(id, dto);
  }

  @Patch(':id/liberar')
  @Roles(...GESTAO)
  @ApiOperation({ summary: 'Cancelar Black List (autorização gerencial)' })
  liberar(@Param('id') id: string, @Body() dto: LiberarMotoristaExternoDto) {
    return this.service.liberar(id, dto);
  }
}
