import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ComercialPricingService } from './comercial-pricing.service';
import { ComercialCurvaAbcQueryDto } from './dto/comercial-curva-abc-query.dto';
import { ComercialElasticidadeQueryDto } from './dto/comercial-elasticidade-query.dto';
import { ComercialPeriodQueryDto } from './dto/comercial-period-query.dto';
import {
  ComercialCurvaAbcRespostaDto,
  ComercialElasticidadeRespostaDto,
  ComercialIndicadoresRespostaDto,
  ComercialLucroPorClienteRespostaDto,
  ComercialLucroPorServicoRespostaDto,
  ComercialRecomendacoesRespostaDto,
  ComercialSeriesTemporaisRespostaDto,
  ComercialSimuladorRespostaDto,
} from './dto/comercial-response.dto';
import { ComercialSeriesTemporaisQueryDto } from './dto/comercial-series-temporais-query.dto';
import { ComercialSimuladorQueryDto } from './dto/comercial-simulador-query.dto';

@ApiTags('comercial-pricing')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('comercial')
export class ComercialPricingController {
  constructor(private readonly comercialPricingService: ComercialPricingService) {}

  @Get('curva-abc')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('comercial:pricing')
  @ApiOperation({
    summary: 'Curva ABC — Pareto 80/15/5 sobre contribuição ao lucro',
    description:
      '`modo=lucro` (default): ordena por lucro absoluto. `modo=margem`: ordena por margem % (rentabilidade relativa), depois mesmo critério cumulativo. Custo via proxy operacional (auditoria × ciclo × PERFORMANCE_CUSTO_MINUTO_PROXY), alocado pelo mix de faturamento.',
  })
  @ApiOkResponse({ type: ComercialCurvaAbcRespostaDto })
  getCurvaAbc(@Query() query: ComercialCurvaAbcQueryDto): Promise<ComercialCurvaAbcRespostaDto> {
    return this.comercialPricingService.getCurvaAbc(query);
  }

  @Get('lucro-por-cliente')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('comercial:pricing')
  @ApiOperation({
    summary: 'Lucratividade por cliente + série mensal (12 competências)',
    description:
      'Margem = (faturamento − custo alocado) / faturamento. Série alinha faturamento.periodo com custo mensal proporcional.',
  })
  @ApiOkResponse({ type: ComercialLucroPorClienteRespostaDto })
  getLucroPorCliente(
    @Query() query: ComercialPeriodQueryDto,
  ): Promise<ComercialLucroPorClienteRespostaDto> {
    return this.comercialPricingService.getLucroPorCliente(query);
  }

  @Get('lucro-por-servico')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('comercial:pricing')
  @ApiOperation({
    summary: 'Lucratividade por tipo de unidade (serviço)',
    description:
      'IMPORT / EXPORT / GATE_IN / GATE_OUT: receita alocada pelo peso de unidades com saída no período.',
  })
  @ApiOkResponse({ type: ComercialLucroPorServicoRespostaDto })
  getLucroPorServico(
    @Query() query: ComercialPeriodQueryDto,
  ): Promise<ComercialLucroPorServicoRespostaDto> {
    return this.comercialPricingService.getLucroPorServico(query);
  }

  @Get('elasticidade')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('comercial:pricing')
  @ApiOperation({
    summary: 'Elasticidade média da demanda (histórico mensal)',
    description:
      'Calcula média de (%Δvolume / %Δpreço médio) entre meses consecutivos; série do volume (saídas) e preço médio (faturamento/volume).',
  })
  @ApiOkResponse({ type: ComercialElasticidadeRespostaDto })
  getElasticidade(@Query() query: ComercialElasticidadeQueryDto): Promise<ComercialElasticidadeRespostaDto> {
    return this.comercialPricingService.getElasticidade(query);
  }

  @Get('series-temporais')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('comercial:pricing')
  @ApiOperation({
    summary: 'Séries financeiras/comerciais (6 ou 12 meses)',
    description:
      'Agregação mensal por competência (YYYY-MM): faturamento, custo operacional estimado, lucro e margem. Opcional por cliente.',
  })
  @ApiOkResponse({ type: ComercialSeriesTemporaisRespostaDto })
  getSeriesTemporais(
    @Query() query: ComercialSeriesTemporaisQueryDto,
  ): Promise<ComercialSeriesTemporaisRespostaDto> {
    return this.comercialPricingService.getSeriesTemporais(query);
  }

  @Get('indicadores')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('comercial:pricing')
  @ApiOperation({
    summary: 'Painel resumido — margem média, lucro e elasticidade de referência',
    description:
      'Agrega faturamento no período, custo proxy global, contagem de clientes com fatura e elasticidade média (janela móvel 12 meses, mesma metodologia de /elasticidade).',
  })
  @ApiOkResponse({ type: ComercialIndicadoresRespostaDto })
  getIndicadores(@Query() query: ComercialPeriodQueryDto): Promise<ComercialIndicadoresRespostaDto> {
    return this.comercialPricingService.getIndicadores(query);
  }

  @Get('simulador')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('comercial:pricing')
  @ApiOperation({
    summary: 'Simulador What-If — preço, margem e volume',
    description:
      'Projeta margens, receita e volume com elasticidade informada ou default negativo (demanda inelástica curta).',
  })
  @ApiOkResponse({ type: ComercialSimuladorRespostaDto })
  getSimulador(@Query() query: ComercialSimuladorQueryDto): ComercialSimuladorRespostaDto {
    return this.comercialPricingService.getSimulador(query);
  }

  @Get('recomendacoes')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('comercial:pricing')
  @ApiOperation({
    summary: 'Recomendações comerciais automáticas',
    description:
      'Regras sobre margem, curva ABC (lucro absoluto), intensidade operacional, boletos em aberto e incentivos (desconto). Somente leitura.',
  })
  @ApiOkResponse({ type: ComercialRecomendacoesRespostaDto })
  getRecomendacoes(@Query() query: ComercialPeriodQueryDto): Promise<ComercialRecomendacoesRespostaDto> {
    return this.comercialPricingService.getRecomendacoes(query);
  }
}
