import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { IaPreditivaService } from './ia-preditiva.service';
import { IaPreditivaDemandaService } from './services/ia-preditiva-demanda.service';
import { IaPreditivaOcupacaoService } from './services/ia-preditiva-ocupacao.service';
import { IaPreditivaProdutividadeService } from './services/ia-preditiva-produtividade.service';
import { IaPreditivaInadimplenciaService } from './services/ia-preditiva-inadimplencia.service';
import { IaPreditivaAnomaliasService } from './services/ia-preditiva-anomalias.service';

@ApiTags('ia-preditiva')
@ApiBearerAuth('access-token')
@Controller('ia-preditiva')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.GERENTE)
@ApiExtraModels()
export class IaPreditivaController {
  constructor(
    private readonly facade: IaPreditivaService,
    private readonly demandaSvc: IaPreditivaDemandaService,
    private readonly ocupacaoSvc: IaPreditivaOcupacaoService,
    private readonly produtividadeSvc: IaPreditivaProdutividadeService,
    private readonly inadimplenciaSvc: IaPreditivaInadimplenciaService,
    private readonly anomaliasSvc: IaPreditivaAnomaliasService,
  ) {}

  @Get('demanda')
  @ApiOperation({
    summary: 'Previsão de demanda (volume operacional)',
    description:
      'Combina **regressão linear** na série mensal de solicitações, **suavização exponencial simples (SES)**, **sazonalidade com 12 fatores mensais** e um proxy de **dias úteis / fins de semana** sobre o volume diário equivalente. ' +
      'Horizontes: **7, 30, 90 e 180 dias**. Confiança em % é derivada do **R²** da regressão. **Limite:** exige histórico agregável; com menos de 3 meses reais é aplicada série sintética mínima internamente.',
  })
  @ApiProduces('application/json')
  @ApiOkResponse({ description: 'Previsões e métricas do modelo local.' })
  demanda() {
    return this.demandaSvc.obterDemanda();
  }

  @Get('ocupacao-patio')
  @ApiOperation({
    summary: 'Previsão de ocupação de pátio',
    description:
      'Estima **ocupação atual %** (vagas ocupadas ÷ capacidade configurável `IA_PRED_PATIO_CAPACIDADE`), projeta **mês seguinte** com regressão sobre série mensal de **criações em `patios`**, calcula **risco de saturação** e expõe **throughput** proxy via solicitações concluídas em 30 dias.',
  })
  @ApiOkResponse({ description: 'Percentuais, risco e volume esperado.' })
  ocupacaoPatio() {
    return this.ocupacaoSvc.obter();
  }

  @Get('produtividade')
  @ApiOperation({
    summary: 'Produtividade prevista (UPH) por regime semanal',
    description:
      'Utiliza contagens semanais de solicitações **CONCLUIDO**, regressão linear temporal e converte para **unidades por hora (UPH)** dividindo pela janela `7 × prodHorasEfectivasPorDia`. Identifica **gargalo provável** por backlog em pendente/aprovado/pátio. **Clima** é apenas um **fator multiplicador opcional** `IA_PRED_CLIMA_FATOR` (sem API meteorológica).',
  })
  @ApiOkResponse({ description: 'UPH, gargalo e impacto ciclo (proxy).' })
  produtividade() {
    return this.produtividadeSvc.obter();
  }

  @Get('inadimplencia')
  @ApiOperation({
    summary: 'Probabilidade de inadimplência por cliente (scorecard)',
    description:
      'Features: **atraso médio ponderado** de boletos vencidos não pagos, posição na **curva ABC** de faturamento 12 meses e **volume log**. Combinação linear + **σ(z)** com pesos ajustáveis via `/treinar`. **Cluster** baixo/médio/alto por faixa de probabilidade.',
  })
  @ApiOkResponse({ description: 'Lista limitada de clientes ranqueados.' })
  inadimplencia() {
    return this.inadimplenciaSvc.obter();
  }

  @Get('anomalias')
  @ApiOperation({
    summary: 'Detecção heurística de anomalias operacionais e fiscais',
    description:
      'Regras: **ISO duplicado** entre solicitações ativas; **gate sem portaria**; **faturamento atípico** por **desvio padrão** (z ≥ `IA_PRED_ANOM_Z`, default 2.5); **movimentação fora do horário** UTC (`IA_PRED_HORA_UTIL_INI`–`IA_PRED_HORA_UTIL_FIM`). Severidade ALTA/MÉDIA/BAIXA.',
  })
  @ApiOkResponse({ description: 'Lista consolidada ordenada por severidade.' })
  anomalias() {
    return this.anomaliasSvc.obter();
  }

  @Post('treinar')
  @ApiOperation({
    summary: 'Pipeline MLOps local — recalibra coeficientes',
    description:
      'Recalcula **coeficientes** dos modelos em processo (demanda SES/blend, φ ocupação, horas produtivas, pesos logísticos), atualiza **qualidade proxy** e opcionalmente **persiste** `data/ia-preditiva-weights.json` se `IA_PRED_PERSIST_WEIGHTS=1`. Nenhum serviço externo é chamado.',
  })
  @ApiOkResponse({ description: 'Resumo das atualizações e metadados de versão.' })
  treinar() {
    return this.facade.treinar();
  }

  @Get('modelos')
  @ApiOperation({
    summary: 'Painel de modelos e versões (estado em memória)',
    description:
      'Lista os identificadores lógicos, hiperparâmetros vigentes e a **última atualização** após treino. Adequado para observabilidade de MLOps simulado.',
  })
  @ApiOkResponse({ description: 'Catálogo e estado atual dos pesos.' })
  modelos() {
    return this.facade.modelos();
  }
}
