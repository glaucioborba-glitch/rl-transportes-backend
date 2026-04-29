import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AutomacaoSchedulerStore } from '../stores/automacao-scheduler.store';
import { CriarCronJobDto } from '../dto/scheduler-automacao.dto';

@ApiTags('automacao-scheduler')
@ApiBearerAuth('access-token')
@Controller('automacao/scheduler')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
export class SchedulerAutomacaoController {
  constructor(private readonly cron: AutomacaoSchedulerStore) {}

  @Get()
  @ApiOperation({ summary: 'Listar definições de cron corporativas (memória)' })
  @Permissions('automacao:read')
  listar() {
    return this.cron.listar();
  }

  @Post()
  @ApiOperation({
    summary: 'Registrar job cron (definição)',
    description: 'Persistência em memória; execução periódica pode ser ligada em fase posterior.',
  })
  @Permissions('automacao:admin')
  criar(@Body() body: CriarCronJobDto) {
    return this.cron.adicionar({
      expressao: body.expressao,
      descricao: body.descricao,
      acao: body.acao,
      ativo: body.ativo ?? true,
      ultimaExecucaoProxy: undefined,
      proximaExecucaoProxy: undefined,
    });
  }
}
