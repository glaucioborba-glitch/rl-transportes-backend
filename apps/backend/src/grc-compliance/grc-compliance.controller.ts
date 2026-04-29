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
import {
  AuditoriaInteligenteRespostaDto,
  ControleGrcRespostaDto,
  DashboardGrcDto,
  GapAnalysisCertificacaoDto,
  PlanoAcaoGrcRespostaDto,
  RiscoGrcRespostaDto,
} from './dto/grc-compliance-response.dto';
import {
  CreateControleGrcDto,
  CreatePlanoAcaoGrcDto,
  CreateRiscoGrcDto,
} from './dto/grc-compliance.dto';
import { GrcComplianceAccessGuard } from './grc-compliance-access.guard';
import { GrcAdminGerenteOnly } from './grc-compliance-metadata';
import { GrcComplianceService } from './grc-compliance.service';

@ApiTags('grc-compliance')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), GrcComplianceAccessGuard)
@Controller('grc')
export class GrcComplianceController {
  constructor(private readonly grc: GrcComplianceService) {}

  @Post('riscos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar risco corporativo',
    description:
      '`severidade` persistida = probabilidade × impacto (1–25). Integrações futuras com auditoria/financeiro apenas via leitura.',
  })
  @ApiCreatedResponse({ type: RiscoGrcRespostaDto })
  criarRisco(@Body() dto: CreateRiscoGrcDto): RiscoGrcRespostaDto {
    return this.grc.createRisco(dto);
  }

  @Get('riscos')
  @ApiOkResponse({ type: [RiscoGrcRespostaDto] })
  listarRiscos(): RiscoGrcRespostaDto[] {
    return this.grc.listRiscos();
  }

  @Post('controles')
  @HttpCode(HttpStatus.CREATED)
  @GrcAdminGerenteOnly()
  @ApiOperation({
    summary: 'Matriz de controles internos',
    description:
      'Exclusivo **ADMIN/GERENTE**. `riscoRelacionadoId` deve existir em POST /grc/riscos.',
  })
  @ApiCreatedResponse({ type: ControleGrcRespostaDto })
  criarControle(@Body() dto: CreateControleGrcDto): ControleGrcRespostaDto {
    return this.grc.createControle(dto);
  }

  @Get('controles')
  @ApiOkResponse({ type: [ControleGrcRespostaDto] })
  listarControles(): ControleGrcRespostaDto[] {
    return this.grc.listControles();
  }

  @Get('auditoria-inteligente')
  @ApiOperation({
    summary: 'Engine de compliance (somente leitura no banco)',
    description:
      'Agrega incidentes a partir de Prisma (NF pendente, boletos vencidos, gates, OCR, proxies RH/segurança). **Não grava** em tabelas legadas.',
  })
  @ApiOkResponse({ type: AuditoriaInteligenteRespostaDto })
  getAuditoriaInteligente(): Promise<AuditoriaInteligenteRespostaDto> {
    return this.grc.getAuditoriaInteligente();
  }

  @Get('certificacoes/gapanalysis')
  @ApiOperation({
    summary: 'Gap analysis ISO 9001 / OEA / ISPS-Code',
    description:
      'Índices derivados de eficácia dos controles cadastrados, score de compliance e % de riscos mitigados/controlados.',
  })
  @ApiOkResponse({ type: GapAnalysisCertificacaoDto })
  getGapAnalysis(): Promise<GapAnalysisCertificacaoDto> {
    return this.grc.getGapAnalysis();
  }

  @Post('planos-acao')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Plano de ação 5W2H' })
  @ApiCreatedResponse({ type: PlanoAcaoGrcRespostaDto })
  criarPlano(@Body() dto: CreatePlanoAcaoGrcDto): PlanoAcaoGrcRespostaDto {
    return this.grc.createPlano(dto);
  }

  @Get('planos-acao')
  @ApiOkResponse({ type: [PlanoAcaoGrcRespostaDto] })
  listarPlanos(): PlanoAcaoGrcRespostaDto[] {
    return this.grc.listPlanos();
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard executivo GRC' })
  @ApiOkResponse({ type: DashboardGrcDto })
  getDashboard(): Promise<DashboardGrcDto> {
    return this.grc.getDashboard();
  }
}
