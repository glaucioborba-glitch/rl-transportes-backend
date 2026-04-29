import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  AvaliacaoRhRespostaDto,
  BscRhRespostaDto,
  DashboardRhPerformanceDto,
  OkrRhRespostaDto,
  RhKpisRespostaDto,
  SugestaoTreinamentoRhDto,
  TreinamentoRhRespostaDto,
} from './dto/rh-performance-response.dto';
import {
  CreateAvaliacaoRhDto,
  CreateOkrRhDto,
  CreateTreinamentoRhDto,
} from './dto/rh-performance.dto';
import { RhPerformanceAccessGuard } from './rh-performance-access.guard';
import { RhPerfAdminGerenteOnly } from './rh-performance-metadata';
import { RhPerformanceService } from './rh-performance.service';

@ApiTags('rh-performance')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RhPerformanceAccessGuard)
@Controller('rh/performance')
export class RhPerformanceController {
  constructor(private readonly rhPerformance: RhPerformanceService) {}

  @Post('avaliacoes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar avaliação de desempenho',
    description:
      '**scoreFinal** = 0,40 × média(aderência + qualidade) + 0,30 × média(comportamental + comprometimento) + 0,30 × notaTécnica — todos os critérios em 0–10.',
  })
  @ApiCreatedResponse({ type: AvaliacaoRhRespostaDto })
  criarAvaliacao(@Body() dto: CreateAvaliacaoRhDto): AvaliacaoRhRespostaDto {
    return this.rhPerformance.createAvaliacao(dto);
  }

  @Get('avaliacoes')
  @ApiOkResponse({ type: [AvaliacaoRhRespostaDto] })
  listarAvaliacoes(): AvaliacaoRhRespostaDto[] {
    return this.rhPerformance.listAvaliacoes();
  }

  @Get('kpis')
  @ApiOperation({
    summary: 'KPIs quantitativos de RH',
    description:
      'Mistura dados locais (baselines por cargo/turno nas avaliações) com **proxies de integração** (`RH_PERF_*`, folha-rh, IA-operacional, dashboards) sem acoplamento de código.',
  })
  @ApiOkResponse({ type: RhKpisRespostaDto })
  getKpis(): RhKpisRespostaDto {
    return this.rhPerformance.getKpis();
  }

  @Post('okr')
  @HttpCode(HttpStatus.CREATED)
  @RhPerfAdminGerenteOnly()
  @ApiOperation({
    summary: 'Cadastrar OKR',
    description:
      'Exclusivo **ADMIN/GERENTE**. Integração com produtividade real e metas financeiras via variáveis de ambiente e rotinas externas — não altera outros módulos.',
  })
  @ApiCreatedResponse({ type: OkrRhRespostaDto })
  criarOkr(@Body() dto: CreateOkrRhDto): OkrRhRespostaDto {
    return this.rhPerformance.createOkr(dto);
  }

  @Get('okr')
  @ApiOkResponse({ type: [OkrRhRespostaDto] })
  listarOkr(): OkrRhRespostaDto[] {
    return this.rhPerformance.listOkrs();
  }

  @Get('bsc')
  @ApiOperation({
    summary: 'Balanced Scorecard (quatro perspectivas)',
    description:
      'Compõe scores 0–100 por perspectiva com KPIs proxy + horas de treinamento realizadas neste módulo.',
  })
  @ApiOkResponse({ type: BscRhRespostaDto })
  getBsc(): BscRhRespostaDto {
    return this.rhPerformance.getBsc();
  }

  @Post('treinamentos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar trilha / treinamento' })
  @ApiCreatedResponse({ type: TreinamentoRhRespostaDto })
  criarTreinamento(@Body() dto: CreateTreinamentoRhDto): TreinamentoRhRespostaDto {
    return this.rhPerformance.createTreinamento(dto);
  }

  @Get('treinamentos')
  @ApiOkResponse({ type: [TreinamentoRhRespostaDto] })
  listarTreinamentos(): TreinamentoRhRespostaDto[] {
    return this.rhPerformance.listTreinamentos();
  }

  @Get('sugestoes-treinamento')
  @ApiOperation({
    summary: 'Sugestões automáticas de treinamento',
    description:
      'Regras sobre última avaliação por colaborador: técnico baixo, comportamental baixo, retrabalho proxy alto.',
  })
  @ApiOkResponse({ type: [SugestaoTreinamentoRhDto] })
  getSugestoesTreinamento(): SugestaoTreinamentoRhDto[] {
    return this.rhPerformance.getSugestoesTreinamento();
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Painel executivo RH estratégico',
    description:
      'Inclui tendência entre períodos, gaps, mapa de competências e progresso médio dos OKR cadastrados.',
  })
  @ApiOkResponse({ type: DashboardRhPerformanceDto })
  getDashboard(): DashboardRhPerformanceDto {
    return this.rhPerformance.getDashboard();
  }
}
