import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { listarGraficoEstados, validarTransicaoIso } from '../estado-operacional.machine';
import { ValidarTransicaoDto } from '../dto/estado-operacional.dto';

@ApiTags('automacao-estados')
@ApiBearerAuth('access-token')
@Controller('automacao/estados')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
export class EstadoOperacionalController {
  @Get()
  @ApiOperation({ summary: 'Grafo de estados ISO do terminal (read-only)' })
  @Permissions('automacao:read')
  grafo() {
    return { estados: listarGraficoEstados() };
  }

  @Post('validar')
  @ApiOperation({ summary: 'Validar transição ISO e inferir estado a partir de flags operacionais' })
  @Permissions('automacao:read')
  validar(@Body() body: ValidarTransicaoDto) {
    const permitido = validarTransicaoIso(body.de, body.para);
    return {
      permitido,
      transicao: { de: body.de, para: body.para },
    };
  }
}
