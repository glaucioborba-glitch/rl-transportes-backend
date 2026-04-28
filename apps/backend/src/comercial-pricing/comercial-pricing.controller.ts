import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ComercialPricingService } from './comercial-pricing.service';
import { ComercialElasticidadeQueryDto } from './dto/comercial-elasticidade-query.dto';
import { ComercialPeriodQueryDto } from './dto/comercial-period-query.dto';
import {
  ComercialCurvaAbcRespostaDto,
  ComercialElasticidadeRespostaDto,
  ComercialLucroPorClienteRespostaDto,
  ComercialLucroPorServicoRespostaDto,
  ComercialRecomendacoesRespostaDto,
  ComercialSimuladorRespostaDto,
} from './dto/comercial-response.dto';
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
    summary: 'Curva ABC estendida por lucratividade (80/15/5 sobre lucro positivo)',
    description:
      'Custo operacional estimado alocado pelo mix de faturamento (proxy auditoria × ciclo × PERFORMANCE_CUSTO_MINUTO_PROXY). Somente leitura.',
  })
  @ApiOkResponse({ type: ComercialCurvaAbcRespostaDto })
  getCurvaAbc(@Query() query: ComercialPeriodQueryDto): Promise<ComercialCurvaAbcRespostaDto> {
    return this.comercialPricingService.getCurvaAbc(query);
  }

  @Get('lucro-por-cliente')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('comercial:pricing')
  @ApiOperation({
    summary: 'Lucro e margem por cliente com série mensal (12 meses)',
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
    summary: 'Lucro por tipo de unidade (IMPORT/EXPORT/GATE_IN/GATE_OUT)',
    description: 'Receita alocada proporcionalmente ao volume de unidades concluídas no período.',
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
    summary: 'Elasticidade média volume × preço médio (histórico mensal)',
    description:
      'Volume = unidades com saída no mês; preço médio = faturamento do mês / volume. Opcional clienteId.',
  })
  @ApiOkResponse({ type: ComercialElasticidadeRespostaDto })
  getElasticidade(@Query() query: ComercialElasticidadeQueryDto): Promise<ComercialElasticidadeRespostaDto> {
    return this.comercialPricingService.getElasticidade(query);
  }

  @Get('simulador')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('comercial:pricing')
  @ApiOperation({
    summary: 'Simulador What-If de preço, margem e volume',
    description:
      'Usa elasticidade informada ou default conservador. Impacto receita linear e volume estimado.',
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
      'Combina margem, curva ABC, intensidade operacional e boletos em aberto (somente leitura).',
  })
  @ApiOkResponse({ type: ComercialRecomendacoesRespostaDto })
  getRecomendacoes(@Query() query: ComercialPeriodQueryDto): Promise<ComercialRecomendacoesRespostaDto> {
    return this.comercialPricingService.getRecomendacoes(query);
  }
}
