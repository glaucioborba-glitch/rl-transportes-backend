import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Iso6346ValidationPipe } from '../common/pipes/iso6346-validation.pipe';
import { AgendamentosService } from './agendamentos.service';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { FilaQueryDto } from './dto/fila-query.dto';
import { UpdateCapacidadeTurnoDto } from './dto/update-capacidade-turno.dto';
import { TriagemReprovarDto } from './dto/triagem-reprovar.dto';

@ApiTags('agendamentos')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('v1/agendamentos')
export class AgendamentosController {
  constructor(private readonly agendamentos: AgendamentosService) {}

  @Get('fila')
  @ApiOperation({ summary: 'Fila do dia / turno — backlog operacional (staff)' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
  @Permissions('agendamentos:ler')
  fila(@Query() query: FilaQueryDto) {
    return this.agendamentos.filaDoDia({ dataRef: query.dataRef, turno: query.turno });
  }

  @Post()
  @ApiOperation({ summary: 'Criar agendamento por container, data e turno (AM/PM)' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA)
  @Permissions('agendamentos:criar')
  criar(@Body(Iso6346ValidationPipe) dto: CreateAgendamentoDto, @CurrentUser() user: AuthUser) {
    return this.agendamentos.criar(dto, user.id);
  }

  @Get('capacidade')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA)
  @Permissions('agendamentos:ler')
  capacidades() {
    return this.agendamentos.listarCapacidades();
  }

  @Put('capacidade')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('agendamentos:admin')
  capacidade(@Body() dto: UpdateCapacidadeTurnoDto, @CurrentUser() user: AuthUser) {
    return this.agendamentos.atualizarCapacidade(dto, user.id);
  }

  @Get('triagem/pendentes')
  @ApiOperation({ summary: 'Triagem intranet — agendamentos aguardando aprovação manual' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA)
  @Permissions('agendamentos:ler')
  triagemPendentes() {
    return this.agendamentos.listarTriagemPendentes();
  }

  @Post('triagem/:id/aprovar')
  @ApiOperation({ summary: 'Triagem — aprovar (CONFIRMADO / aguardando gate)' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA)
  @Permissions('agendamentos:criar')
  triagemAprovar(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.agendamentos.aprovarTriagem(id, user.id);
  }

  @Post('triagem/:id/reprovar')
  @ApiOperation({ summary: 'Triagem — reprovar com motivo' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA)
  @Permissions('agendamentos:criar')
  triagemReprovar(
    @Param('id') id: string,
    @Body() dto: TriagemReprovarDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.agendamentos.reprovarTriagem(id, dto.motivo, user.id);
  }
}
