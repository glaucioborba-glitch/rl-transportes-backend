import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  BeneficioRhRespostaDto,
  CalculoFolhaRespostaDto,
  ColaboradorRhRespostaDto,
  CustosTurnoRespostaDto,
  DashboardFolhaRhDto,
  PresencaRhRespostaDto,
  ProjecaoAnualRhRespostaDto,
} from './dto/folha-rh-response.dto';
import {
  CreateBeneficioRhDto,
  CreateColaboradorRhDto,
  CreatePresencaRhDto,
  MesReferenciaQueryDto,
} from './dto/folha-rh.dto';
import { FolhaRhService } from './folha-rh.service';

const FOLHA_RH_ROLES = [Role.ADMIN, Role.GERENTE];

@ApiTags('folha-rh')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(...FOLHA_RH_ROLES)
@Controller('folha')
export class FolhaRhController {
  constructor(private readonly folha: FolhaRhService) {}

  @Post('colaboradores')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastrar colaborador',
    description:
      'Armazenamento em memória até migração Prisma. Campo `beneficiosAtivos` referencia nomes cadastrados em POST /folha/beneficios.',
  })
  @ApiCreatedResponse({ type: ColaboradorRhRespostaDto })
  criarColaborador(@Body() dto: CreateColaboradorRhDto): ColaboradorRhRespostaDto {
    return this.folha.createColaborador(dto);
  }

  @Get('colaboradores')
  @ApiOperation({ summary: 'Listar colaboradores' })
  @ApiOkResponse({ type: [ColaboradorRhRespostaDto] })
  listarColaboradores(): ColaboradorRhRespostaDto[] {
    return this.folha.listColaboradores();
  }

  @Post('beneficios')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastrar tipo de benefício (catálogo)',
    description:
      '`fixo`: custo empresa mensal; `percentual`: percentual sobre salário contratual (valorMensal = %); `coparticipacao`: custo empresa + desconto estimado em folha.',
  })
  @ApiCreatedResponse({ type: BeneficioRhRespostaDto })
  criarBeneficio(@Body() dto: CreateBeneficioRhDto): BeneficioRhRespostaDto {
    return this.folha.createBeneficio(dto);
  }

  @Get('beneficios')
  @ApiOkResponse({ type: [BeneficioRhRespostaDto] })
  listarBeneficios(): BeneficioRhRespostaDto[] {
    return this.folha.listBeneficios();
  }

  @Post('presencas')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar presença simplificada',
    description:
      'Agrega horas normais, extras, adicional noturno e falta para competência (YYYY-MM da data).',
  })
  @ApiCreatedResponse({ type: PresencaRhRespostaDto })
  criarPresenca(@Body() dto: CreatePresencaRhDto): PresencaRhRespostaDto {
    return this.folha.createPresenca(dto);
  }

  @Get('presencas')
  @ApiOkResponse({ type: [PresencaRhRespostaDto] })
  listarPresencas(): PresencaRhRespostaDto[] {
    return this.folha.listPresencas();
  }

  @Get('calculo')
  @ApiOperation({
    summary: 'Cálculo da folha mensal',
    description:
      '**Salário proporcional**: proporcional a dias úteis sem falta vs dias úteis do mês (proxy feriados `FOLHA_FERIADOS_NACIONAIS_MES`). Sem lançamentos de presença no mês → salário integral.\n\n' +
      '**HE**: primeiras 2h × 1,5 × VH; excedente × 2 × VH.\n\n' +
      '**Adicional noturno**: 20% × VH × horas.\n\n' +
      '**DSR reflexo**: (Σ HE / dias úteis) × (domingos + feriados).\n\n' +
      '**INSS funcionário**: faixas progressivas (`calcularInssProgressivo`). Teto opcional `FOLHA_INSS_TETO`.\n\n' +
      '**FGTS**: 8% patronal sobre base bruta.\n\n' +
      '**Encargos patronais**: proxy percentual `FOLHA_ENCARGOS_PATRONAIS_PCT` (adicional ao FGTS).\n\n' +
      '**Provisões**: férias 1/12 e 13º 1/12 sobre salário contratual.',
  })
  @ApiOkResponse({ type: CalculoFolhaRespostaDto })
  getCalculo(@Query() q: MesReferenciaQueryDto): CalculoFolhaRespostaDto {
    return this.folha.getCalculo(q.mes);
  }

  @Get('custos-turno')
  @ApiOperation({
    summary: 'Centro de custo por turno',
    description:
      'Agrega `custoTotalEmpresa` por MANHA/TARDE/NOITE e distribui proxy entre operações (`FOLHA_SIMULADOR_OPERACOES_COUNT`) para alinhamento conceitual com simulador/planejamento sem acoplamento de código.',
  })
  @ApiOkResponse({ type: CustosTurnoRespostaDto })
  getCustosTurno(@Query() q: MesReferenciaQueryDto): CustosTurnoRespostaDto {
    return this.folha.getCustosTurno(q.mes);
  }

  @Get('projecao-anual')
  @ApiOperation({
    summary: 'Projeção anual de RH',
    description:
      'Série 12 meses a partir do mês corrente; custos de folha, benefícios e provisões. Contratações previstas via `FOLHA_PREVISAO_ADMISSOES_ANO`. Impacto em caixa usa `FINANCEIRO_SALDO_CONTA_PROXY` (Fase 9).',
  })
  @ApiOkResponse({ type: ProjecaoAnualRhRespostaDto })
  getProjecaoAnual(): ProjecaoAnualRhRespostaDto {
    return this.folha.getProjecaoAnual();
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Painel executivo de RH',
    description:
      'Headcount ativo no mês corrente, custos consolidados, absenteísmo por presenças e eficiência por turno.',
  })
  @ApiOkResponse({ type: DashboardFolhaRhDto })
  getDashboard(): DashboardFolhaRhDto {
    return this.folha.getDashboard();
  }
}
