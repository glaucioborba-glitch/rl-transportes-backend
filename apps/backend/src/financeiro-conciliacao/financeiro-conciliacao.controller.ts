import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  ConciliacaoManualDto,
  ConciliacaoQueryDto,
  ExtratoImportarDto,
  ExtratoListarQueryDto,
  FluxoCaixaQueryDto,
} from './dto/financeiro-conciliacao-query.dto';
import {
  ConciliacaoAutomaticaRespostaDto,
  ConciliacaoManualRespostaDto,
  DashboardFinanceiroRespostaDto,
  ExtratoImportarRespostaDto,
  ExtratoLoteListaDto,
  FluxoCaixaRespostaDto,
  PrevisibilidadeRespostaDto,
} from './dto/financeiro-conciliacao-response.dto';
import { FinanceiroConciliacaoService } from './financeiro-conciliacao.service';

const FINANCEIRO_ROLES = [Role.ADMIN, Role.GERENTE];

@ApiTags('financeiro-conciliacao')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(...FINANCEIRO_ROLES)
@Controller('financeiro')
export class FinanceiroConciliacaoController {
  constructor(private readonly financeiroConciliacaoService: FinanceiroConciliacaoService) {}

  @Post('extratos/importar')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Importar extrato OFX ou CSV',
    description:
      'Normaliza lançamentos em memória (sem persistir arquivo bruto). Formatos: OFX (subset STMTTRN) ou CSV com colunas data,valor,historico[,tipo][,documento].',
  })
  @ApiOkResponse({ type: ExtratoImportarRespostaDto })
  importarExtrato(@Body() dto: ExtratoImportarDto): Promise<ExtratoImportarRespostaDto> {
    return this.financeiroConciliacaoService.importarExtrato(dto);
  }

  @Get('extratos/listar')
  @ApiOperation({ summary: 'Listar lotes de extratos importados (memória do processo).' })
  @ApiOkResponse({ type: [ExtratoLoteListaDto] })
  listarExtratos(@Query() query: ExtratoListarQueryDto): ExtratoLoteListaDto[] {
    return this.financeiroConciliacaoService.listarExtratos(query.batchId);
  }

  @Get('conciliacao')
  @ApiOperation({
    summary: 'Conciliação bancária automática',
    description:
      'Cruza linhas de extrato (crédito) com boletos: número no histórico, valor exato ou ±R$0,05; vínculos manuais prevalecem.',
  })
  @ApiOkResponse({ type: ConciliacaoAutomaticaRespostaDto })
  getConciliacao(@Query() query: ConciliacaoQueryDto): Promise<ConciliacaoAutomaticaRespostaDto> {
    return this.financeiroConciliacaoService.getConciliacaoAutomatica(query.batchId);
  }

  @Post('conciliacao/manual')
  @ApiOperation({
    summary: 'Conciliação manual assistida',
    description:
      'Força vínculo extrato × boleto × faturamento e registra auditoria obrigatória (INSERT em `auditorias`).',
  })
  @ApiOkResponse({ type: ConciliacaoManualRespostaDto })
  conciliacaoManual(
    @Body() dto: ConciliacaoManualDto,
    @CurrentUser('id') usuarioId: string,
  ): Promise<ConciliacaoManualRespostaDto> {
    return this.financeiroConciliacaoService.conciliacaoManual(dto, usuarioId);
  }

  @Get('fluxo-caixa')
  @ApiOperation({
    summary: 'Fluxo de caixa (7 / 30 / 90 dias)',
    description:
      'Projeção determinística com custos fixos (FINANCEIRO_CUSTOS_FIXOS_MENSAL / CUSTOS_FIXOS_MENSAL) e boletos em aberto no horizonte.',
  })
  @ApiOkResponse({ type: FluxoCaixaRespostaDto })
  getFluxoCaixa(@Query() query: FluxoCaixaQueryDto): Promise<FluxoCaixaRespostaDto> {
    return this.financeiroConciliacaoService.getFluxoCaixa(query.horizonte);
  }

  @Get('previsibilidade')
  @ApiOperation({
    summary: 'Previsibilidade financeira avançada',
    description:
      'Combina série de faturamentos, demanda projetada (saídas), forecast financeiro e elasticidade proxy.',
  })
  @ApiOkResponse({ type: PrevisibilidadeRespostaDto })
  getPrevisibilidade(): Promise<PrevisibilidadeRespostaDto> {
    return this.financeiroConciliacaoService.getPrevisibilidade();
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Painel executivo de tesouraria' })
  @ApiOkResponse({ type: DashboardFinanceiroRespostaDto })
  getDashboard(): Promise<DashboardFinanceiroRespostaDto> {
    return this.financeiroConciliacaoService.getDashboard();
  }
}
