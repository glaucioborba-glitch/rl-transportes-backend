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
import { FiscalGovernancaQueryDto } from './dto/fiscal-governanca-query.dto';
import {
  FiscalAuditoriaInteligenteRespostaDto,
  FiscalConciliacaoRespostaDto,
  FiscalDashboardRespostaDto,
  FiscalNfseMonitorRespostaDto,
  FiscalSaneamentoSugeridoRespostaDto,
} from './dto/fiscal-governanca-response.dto';
import { FiscalGovernancaService } from './fiscal-governanca.service';

const FISCAL_GOVERNANCA_ROLES = [Role.ADMIN, Role.GERENTE];

@ApiTags('fiscal-governanca')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(...FISCAL_GOVERNANCA_ROLES)
@Controller('fiscal')
export class FiscalGovernancaController {
  constructor(private readonly fiscalGovernancaService: FiscalGovernancaService) {}

  @Get('conciliacao')
  @ApiOperation({
    summary: 'Conciliação fiscal completa',
    description:
      'Cruza faturamentos, itens, boletos, NFS-e (`nfs_emitidas`) e regras de divergência; somente leitura. Equivalente conceitual a GET /fiscal/conciliação.',
  })
  @ApiOkResponse({ type: FiscalConciliacaoRespostaDto })
  getConciliacao(
    @Query() query: FiscalGovernancaQueryDto,
  ): Promise<FiscalConciliacaoRespostaDto> {
    return this.fiscalGovernancaService.getConciliacao(query);
  }

  @Get('auditoria-inteligente')
  @ApiOperation({
    summary: 'Auditoria inteligente',
    description:
      'Análise sobre registros em `auditorias`: alterações sensíveis, fluxos operacionais inconsistentes, horários atípicos e eventos SEGURANCA.',
  })
  @ApiOkResponse({ type: FiscalAuditoriaInteligenteRespostaDto })
  getAuditoriaInteligente(
    @Query() query: FiscalGovernancaQueryDto,
  ): Promise<FiscalAuditoriaInteligenteRespostaDto> {
    return this.fiscalGovernancaService.getAuditoriaInteligente(query);
  }

  @Get('nfse-monitor')
  @ApiOperation({
    summary: 'Monitor municipal NFS-e',
    description:
      'Painel de status (`statusIpm`) com buckets EMITIDO/PENDENTE/CANCELADO e alertas (>24h, falhas/rejeições).',
  })
  @ApiOkResponse({ type: FiscalNfseMonitorRespostaDto })
  getNfseMonitor(
    @Query() query: FiscalGovernancaQueryDto,
  ): Promise<FiscalNfseMonitorRespostaDto> {
    return this.fiscalGovernancaService.getNfseMonitor(query);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Painel fiscal executivo',
    description:
      'Indicadores agregados de faturamento, NFS-e, boletos vencidos, divergências e índice de confiabilidade.',
  })
  @ApiOkResponse({ type: FiscalDashboardRespostaDto })
  getDashboard(
    @Query() query: FiscalGovernancaQueryDto,
  ): Promise<FiscalDashboardRespostaDto> {
    return this.fiscalGovernancaService.getDashboard(query);
  }

  @Get('saneamento-sugerido')
  @ApiOperation({
    summary: 'Robô de saneamento (simulação)',
    description:
      'Lista apenas sugestões determinísticas a partir das divergências e pendências; não executa integrações.',
  })
  @ApiOkResponse({ type: FiscalSaneamentoSugeridoRespostaDto })
  getSaneamentoSugerido(
    @Query() query: FiscalGovernancaQueryDto,
  ): Promise<FiscalSaneamentoSugeridoRespostaDto> {
    return this.fiscalGovernancaService.getSaneamentoSugerido(query);
  }
}
