import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RegrasAutomacaoService } from './regras-automacao.service';
import { CriarRegraDto } from '../dto/regras-automacao.dto';

@ApiTags('automacao-regras')
@ApiBearerAuth('access-token')
@Controller('automacao/regras')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
export class RegrasAutomacaoController {
  constructor(private readonly regras: RegrasAutomacaoService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar regra de negócio',
    description:
      'Motor **if/then** com expressões simples (`container.stay_hours>72`). THEN aceita `alerta`, `auditoria`, `workflow:<uuid>`. **RBAC:** `ADMIN`.',
  })
  @Permissions('automacao:admin')
  criar(@Body() body: CriarRegraDto) {
    return this.regras.salvar({
      nome: body.nome,
      tipo: body.tipo,
      if: body.if,
      then: body.then,
      else: body.else,
      ativo: body.ativo ?? true,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar regras' })
  @Permissions('automacao:read')
  listar() {
    return this.regras.listar();
  }
}
