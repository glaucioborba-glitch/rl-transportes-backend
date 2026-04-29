import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  PlanejamentoCapexQueryDto,
  PlanejamentoCenarioEstrategicoQueryDto,
  PlanejamentoForecastFinanceiroQueryDto,
} from './dto/planejamento-estrategico-query.dto';
import {
  PlanejamentoCapexRespostaDto,
  PlanejamentoCenarioEstrategicoRespostaDto,
  PlanejamentoDemandaAnualRespostaDto,
  PlanejamentoEquilibrioRespostaDto,
  PlanejamentoForecastFinanceiroRespostaDto,
  PlanejamentoOpexRespostaDto,
} from './dto/planejamento-estrategico-response.dto';
import { PlanejamentoEstrategicoService } from './planejamento-estrategico.service';

const PLANEJAMENTO_ROLES = [Role.ADMIN, Role.GERENTE];

@ApiTags('planejamento-estrategico')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(...PLANEJAMENTO_ROLES)
@Controller('planejamento')
export class PlanejamentoEstrategicoController {
  constructor(private readonly planejamentoEstrategicoService: PlanejamentoEstrategicoService) {}

  @Get('demanda-anual')
  @ApiOperation({
    summary: 'Previsão de demanda anual (12 meses)',
    description:
      'Volume projetado por competência com regressão linear + fatores sazonais sobre histórico de saídas mensais.',
  })
  @ApiOkResponse({ type: PlanejamentoDemandaAnualRespostaDto })
  getDemandaAnual(): Promise<PlanejamentoDemandaAnualRespostaDto> {
    return this.planejamentoEstrategicoService.getDemandaAnual();
  }

  @Get('forecast-financeiro')
  @ApiOperation({
    summary: 'Forecast financeiro anual',
    description:
      'Curva de receita 12 meses com cenários otimista/base/pessimista. Margem baseada em parâmetro executivo e elasticidade proxy — não altera pricing nem faturamento.',
  })
  @ApiOkResponse({ type: PlanejamentoForecastFinanceiroRespostaDto })
  getForecastFinanceiro(
    @Query() query: PlanejamentoForecastFinanceiroQueryDto,
  ): Promise<PlanejamentoForecastFinanceiroRespostaDto> {
    return this.planejamentoEstrategicoService.getForecastFinanceiro(query);
  }

  @Get('opex')
  @ApiOperation({
    summary: 'Planejamento de OPEX (custos operacionais mensais)',
    description:
      'Combina custo proxy por operação (auditoria × ciclo × custo/minuto), fixos por turno/operador e custos variáveis de ocupação do pátio.',
  })
  @ApiOkResponse({ type: PlanejamentoOpexRespostaDto })
  getOpex(): Promise<PlanejamentoOpexRespostaDto> {
    return this.planejamentoEstrategicoService.getOpex();
  }

  @Get('capex')
  @ApiOperation({
    summary: 'CAPEX e ROI proxy por expansão',
    description:
      'Divide investimento estimado por linhas (pátio, portaria/gate, tecnologia) e projeta payback em 12/24/36 meses.',
  })
  @ApiOkResponse({ type: PlanejamentoCapexRespostaDto })
  getCapex(@Query() query: PlanejamentoCapexQueryDto): Promise<PlanejamentoCapexRespostaDto> {
    return this.planejamentoEstrategicoService.getCapex(query);
  }

  @Get('equilibrio')
  @ApiOperation({
    summary: 'Equilíbrio capacidade × demanda × custo por unidade',
    description:
      'Consolida projeção de demanda e OPEX para diagnosticar déficit de capacidade e sweet spot operativo.',
  })
  @ApiOkResponse({ type: PlanejamentoEquilibrioRespostaDto })
  getEquilibrio(): Promise<PlanejamentoEquilibrioRespostaDto> {
    return this.planejamentoEstrategicoService.getEquilibrio();
  }

  @Get('cenario-estrategico')
  @ApiOperation({
    summary: 'What-if estratégico para diretoria',
    description:
      'Simula impactos combinados em receita, margem e capacidade; classifica risco operacional e gera recomendação executiva.',
  })
  @ApiOkResponse({ type: PlanejamentoCenarioEstrategicoRespostaDto })
  getCenarioEstrategico(
    @Query() query: PlanejamentoCenarioEstrategicoQueryDto,
  ): Promise<PlanejamentoCenarioEstrategicoRespostaDto> {
    return this.planejamentoEstrategicoService.getCenarioEstrategico(query);
  }
}
