import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  PlanejamentoCenarioPessoalQueryDto,
  PlanejamentoContratacaoQueryDto,
  PlanejamentoHeadcountOtimoQueryDto,
  PlanejamentoOrcamentoAnualQueryDto,
} from './dto/planejamento-pessoal-query.dto';
import {
  PlanejamentoCenarioPessoalRespostaDto,
  PlanejamentoContratacaoRespostaDto,
  PlanejamentoHeadcountOtimoRespostaDto,
  PlanejamentoMatrizTurnosRespostaDto,
  PlanejamentoOrcamentoAnualRespostaDto,
} from './dto/planejamento-pessoal-response.dto';
import { PlanejamentoPessoalService } from './planejamento-pessoal.service';

const PLANEJAMENTO_PESSOAL_ROLES = [Role.ADMIN, Role.GERENTE];

@ApiTags('planejamento-pessoal')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(...PLANEJAMENTO_PESSOAL_ROLES)
@Controller('planejamento')
export class PlanejamentoPessoalController {
  constructor(private readonly planejamentoPessoalService: PlanejamentoPessoalService) {}

  @Get('headcount-otimo')
  @ApiOperation({
    summary: 'Headcount ótimo operacional por turno',
    description:
      'Recomendação de equipe com base em demanda prevista e produtividade (histórico via auditoria ou parâmetro). Read-only.',
  })
  @ApiOkResponse({ type: PlanejamentoHeadcountOtimoRespostaDto })
  getHeadcountOtimo(
    @Query() query: PlanejamentoHeadcountOtimoQueryDto,
  ): Promise<PlanejamentoHeadcountOtimoRespostaDto> {
    return this.planejamentoPessoalService.getHeadcountOtimo(query);
  }

  @Get('orcamento-anual')
  @ApiOperation({
    summary: 'Orçamento operacional anual (OPEX de pessoal projetado)',
    description:
      'Série mensal com encargos e proxy de HE a partir do OPEX estratégico; delta mês a mês %.',
  })
  @ApiOkResponse({ type: PlanejamentoOrcamentoAnualRespostaDto })
  getOrcamentoAnual(
    @Query() query: PlanejamentoOrcamentoAnualQueryDto,
  ): Promise<PlanejamentoOrcamentoAnualRespostaDto> {
    return this.planejamentoPessoalService.getOrcamentoAnual(query);
  }

  @Get('cenario-pessoal')
  @ApiOperation({
    summary: 'Cenário What-If de pessoal',
    description:
      'Impactos proxy em capacidade, ciclo, custo/hora e treinamento; opcional movimentação entre turnos.',
  })
  @ApiOkResponse({ type: PlanejamentoCenarioPessoalRespostaDto })
  getCenarioPessoal(
    @Query() query: PlanejamentoCenarioPessoalQueryDto,
  ): Promise<PlanejamentoCenarioPessoalRespostaDto> {
    return this.planejamentoPessoalService.getCenarioPessoal(query);
  }

  @Get('turnos')
  @ApiOperation({
    summary: 'Matriz de turnos (simulador RH)',
    description:
      'Produtividade, custo proxy, operador-hora e saturação por MANHA/TARDE/NOITE; read-only.',
  })
  @ApiOkResponse({ type: PlanejamentoMatrizTurnosRespostaDto })
  getMatrizTurnos(): Promise<PlanejamentoMatrizTurnosRespostaDto> {
    return this.planejamentoPessoalService.getMatrizTurnos();
  }

  @Get('contratacao')
  @ApiOperation({
    summary: 'Projeção de contratação e treinamento',
    description:
      'Previsão de contratar/treinar, risco de turnover proxy e ROI de contratação com base em demanda 12 meses.',
  })
  @ApiOkResponse({ type: PlanejamentoContratacaoRespostaDto })
  getContratacao(
    @Query() query: PlanejamentoContratacaoQueryDto,
  ): Promise<PlanejamentoContratacaoRespostaDto> {
    return this.planejamentoPessoalService.getContratacao(query);
  }
}
