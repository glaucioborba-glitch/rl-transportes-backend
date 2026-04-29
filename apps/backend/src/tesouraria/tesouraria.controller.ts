import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
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
  AgendaPagamentosDto,
  ContratoRespostaDto,
  DashboardTesourariaDto,
  DespesaRespostaDto,
  FornecedorRespostaDto,
  ImpactoCaixaRespostaDto,
  SugestaoTesourariaDto,
} from './dto/tesouraria-response.dto';
import {
  CreateContratoDto,
  CreateDespesaDto,
  CreateFornecedorDto,
} from './dto/tesouraria.dto';
import { TesourariaService } from './tesouraria.service';

const TESOURARIA_ROLES = [Role.ADMIN, Role.GERENTE];

@ApiTags('tesouraria')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(...TESOURARIA_ROLES)
@Controller('tesouraria')
export class TesourariaController {
  constructor(private readonly tesouraria: TesourariaService) {}

  @Post('despesas')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastrar despesa (AP)',
    description:
      'Persistência em memória no processo (restart limpa dados). Migração Prisma posterior substituirá o armazenamento.',
  })
  @ApiCreatedResponse({ type: DespesaRespostaDto })
  criarDespesa(@Body() dto: CreateDespesaDto): DespesaRespostaDto {
    return this.tesouraria.createDespesa(dto);
  }

  @Get('despesas')
  @ApiOperation({
    summary: 'Listar despesas',
    description:
      'Lista todas as despesas com `statusEfetivo` derivado de vencimento × status persistido.',
  })
  @ApiOkResponse({ type: [DespesaRespostaDto] })
  listarDespesas(): DespesaRespostaDto[] {
    return this.tesouraria.listDespesas();
  }

  @Post('fornecedores')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastrar fornecedor (memória do processo)' })
  @ApiCreatedResponse({ type: FornecedorRespostaDto })
  criarFornecedor(@Body() dto: CreateFornecedorDto): FornecedorRespostaDto {
    return this.tesouraria.createFornecedor(dto);
  }

  @Get('fornecedores')
  @ApiOperation({ summary: 'Listar fornecedores' })
  @ApiOkResponse({ type: [FornecedorRespostaDto] })
  listarFornecedores(): FornecedorRespostaDto[] {
    return this.tesouraria.listFornecedores();
  }

  @Post('contratos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cadastrar contrato recorrente',
    description: '`fornecedorId` deve existir em POST /tesouraria/fornecedores.',
  })
  @ApiCreatedResponse({ type: ContratoRespostaDto })
  criarContrato(@Body() dto: CreateContratoDto): ContratoRespostaDto {
    return this.tesouraria.createContrato(dto);
  }

  @Get('contratos')
  @ApiOperation({ summary: 'Listar contratos' })
  @ApiOkResponse({ type: [ContratoRespostaDto] })
  listarContratos(): ContratoRespostaDto[] {
    return this.tesouraria.listContratos();
  }

  @Get('agenda')
  @ApiOperation({
    summary: 'Agenda de pagamentos (AP)',
    description:
      'Combina despesas (inclui IMPOSTOS), parcelas mensais/anuais e contratos. Agrega pagamentos por dia/semana/mês no horizonte projetado.',
  })
  @ApiOkResponse({ type: AgendaPagamentosDto })
  getAgenda(): AgendaPagamentosDto {
    return this.tesouraria.getAgenda();
  }

  @Get('impacto-caixa')
  @ApiOperation({
    summary: 'Impacto em caixa vs fluxo Fase 9',
    description:
      'Por janela (7/15/30/90 dias): saídas OPEX tesouraria (exclui CAPEX nas métricas `*Opex`), totais, entradas previstas de boletos (taxa FINANCEIRO_RECUPERACAO_BOLETOS_PROXY), custos fixos e comprometidas prorrateados (mesmas premissas do GET /financeiro/fluxo-caixa), e caixa líquido projetado.',
  })
  @ApiOkResponse({ type: ImpactoCaixaRespostaDto })
  getImpactoCaixa(): Promise<ImpactoCaixaRespostaDto> {
    return this.tesouraria.getImpactoCaixa();
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Painel executivo de tesouraria',
    description:
      'Indicadores mensais, curvas OPEX/CAPEX 12 meses, risco de saídas e score de confiabilidade (duplicidades e atrasos).',
  })
  @ApiOkResponse({ type: DashboardTesourariaDto })
  getDashboard(): Promise<DashboardTesourariaDto> {
    return this.tesouraria.getDashboard();
  }

  @Get('sugestoes')
  @ApiOperation({
    summary: 'Sugestões automáticas (auditoria de despesas)',
    description:
      'Regras heurísticas: reajuste de contrato próximo, despesa acima da média por categoria, duplicidade potencial, fornecedor sem contrato, risco de caixa vs projeção.',
  })
  @ApiOkResponse({ type: [SugestaoTesourariaDto] })
  getSugestoes(): Promise<SugestaoTesourariaDto[]> {
    return this.tesouraria.getSugestoes();
  }
}
