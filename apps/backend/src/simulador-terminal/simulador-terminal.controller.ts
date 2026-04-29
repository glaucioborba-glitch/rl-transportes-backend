import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  SimuladorCenarioQueryDto,
  SimuladorExpansaoQueryDto,
  SimuladorProjecaoQueryDto,
  SimuladorTurnosQueryDto,
} from './dto/simulador-terminal-query.dto';
import {
  SimuladorCapacidadeRespostaDto,
  SimuladorCenarioRespostaDto,
  SimuladorExpansaoRespostaDto,
  SimuladorProjecaoRespostaDto,
  SimuladorTurnosRespostaDto,
} from './dto/simulador-terminal-response.dto';
import { SimuladorTerminalService } from './simulador-terminal.service';

/** Gestão: todas as análises e proxies estratégicos. Operadores: capacidade + cenário What-If simplificado. */
const SIM_GESTAO = [Role.ADMIN, Role.GERENTE];
const SIM_OPERADOR_CENARIO = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_PATIO,
];

@ApiTags('simulador-terminal')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('simulador')
export class SimuladorTerminalController {
  constructor(private readonly simuladorTerminalService: SimuladorTerminalService) {}

  @Get('capacidade')
  @Roles(...SIM_OPERADOR_CENARIO)
  @ApiOperation({
    summary: 'Capacidade atual do terminal',
    description:
      'Slots totais (policy), ocupação, saturação, throughput médio/pico em portaria e gate, ciclo médio recente e densidade por quadra.',
  })
  @ApiOkResponse({ type: SimuladorCapacidadeRespostaDto })
  getCapacidade(): Promise<SimuladorCapacidadeRespostaDto> {
    return this.simuladorTerminalService.getCapacidadeAtual();
  }

  @Get('projecao-saturacao')
  @Roles(...SIM_GESTAO)
  @ApiOperation({
    summary: 'Projeção de saturação e throughput (7 / 14 / 30 dias)',
    description:
      'Usa saídas diárias históricas e tendência linear leve; opcionalmente um único horizonte via query.',
  })
  @ApiOkResponse({ type: SimuladorProjecaoRespostaDto })
  getProjecao(@Query() query: SimuladorProjecaoQueryDto): Promise<SimuladorProjecaoRespostaDto> {
    return this.simuladorTerminalService.getProjecaoSaturacao(query);
  }

  @Get('cenario')
  @Roles(...SIM_OPERADOR_CENARIO)
  @ApiOperation({
    summary: 'Simulador What-If de cenário',
    description:
      'Combina variação de demanda, turnos, expansão de quadras e volume de novo cliente; estima saturação, ciclo, expansão física necessária e gargalos prováveis.',
  })
  @ApiOkResponse({ type: SimuladorCenarioRespostaDto })
  getCenario(@Query() query: SimuladorCenarioQueryDto): Promise<SimuladorCenarioRespostaDto> {
    return this.simuladorTerminalService.getCenarioWhatIf(query);
  }

  @Get('expansao')
  @Roles(...SIM_GESTAO)
  @ApiOperation({
    summary: 'Cenários de expansão física e ROI operacional (proxy)',
    description:
      'Estima ganho de slots, nova saturação, impacto em ciclo e proxies de ROI/payback usando custos e margens configuráveis por ambiente.',
  })
  @ApiOkResponse({ type: SimuladorExpansaoRespostaDto })
  getExpansao(@Query() query: SimuladorExpansaoQueryDto): Promise<SimuladorExpansaoRespostaDto> {
    return this.simuladorTerminalService.getExpansao(query);
  }

  @Get('turnos')
  @Roles(...SIM_GESTAO)
  @ApiOperation({
    summary: 'Simulação de impacto em turnos',
    description:
      'Produtividade relativa por turno (proxy auditoria) e ajuste opcional ao reduzir ou intensificar um turno.',
  })
  @ApiOkResponse({ type: SimuladorTurnosRespostaDto })
  getTurnos(@Query() query: SimuladorTurnosQueryDto): Promise<SimuladorTurnosRespostaDto> {
    return this.simuladorTerminalService.getTurnos(query);
  }
}
