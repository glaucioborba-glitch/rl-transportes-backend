import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DatahubPipelineGuard } from './guards/datahub-pipeline.guard';
import { DatahubPeriodQueryDto } from './dto/datahub-period-query.dto';
import { LakeIngestDto } from './dto/lake-ingest.dto';
import { DatahubLakeService } from './services/datahub-lake.service';
import { DatahubDwService } from './services/datahub-dw.service';
import { DatahubEtlService } from './services/datahub-etl.service';
import { DatahubQualityService } from './services/datahub-quality.service';
import { DatahubBiService } from './services/datahub-bi.service';
import { DatahubExportService } from './services/datahub-export.service';
import { DatahubPipelineObsService } from './services/datahub-pipeline-obs.service';
import type { LakeOrigem } from './datahub.types';

@ApiTags('datahub')
@ApiBearerAuth('access-token')
@Controller('datahub')
export class DatahubController {
  constructor(
    private readonly lake: DatahubLakeService,
    private readonly dw: DatahubDwService,
    private readonly etl: DatahubEtlService,
    private readonly quality: DatahubQualityService,
    private readonly bi: DatahubBiService,
    private readonly exportSvc: DatahubExportService,
    private readonly pipelineObs: DatahubPipelineObsService,
  ) {}

  @Post('lake/ingest')
  @UseGuards(AuthGuard('jwt'), RolesGuard, DatahubPipelineGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @ApiBody({ type: LakeIngestDto })
  @ApiOperation({
    summary: 'Data Lake — ingestão RAW (JSON)',
    description:
      '**Pipeline (TI/Dados)** — ADMIN ou GERENTE com e-mail em `DATAHUB_TI_EMAILS`. ' +
      'Armazena snapshot bruto por origem (operacional, financeiro, fiscal, RH, IA, GRC). Sem transformação. ' +
      'Caminho virtual inclui versionamento `YYYY/MM/DD/HH/mm` e compactação gzip **simulada** (~35% do tamanho bruto).',
  })
  ingestLake(@Body() dto: LakeIngestDto) {
    return this.lake.ingest(dto.origem as LakeOrigem, dto.payload);
  }

  @Get('lake/files')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:lake:list')
  @ApiOperation({
    summary: 'Data Lake — listar objetos RAW recentes',
    description:
      '**TI/Dados ou ADMIN** — requer permissão `datahub:lake:list` (gerente de negócio puro não possui).',
  })
  listLake() {
    return this.lake.listarArquivos();
  }

  @Get('dw/fatos')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:dw:read')
  @ApiOperation({
    summary: 'Data Warehouse — fatos (Kimball / star schema lógico)',
    description:
      'Fatos persistidos em materialized views PostgreSQL (`mv_datahub_fato_*`); cache L1 TTL 5 min. ' +
      'Dimensões Kimball via `POST /datahub/etl/carregar`.',
  })
  dwFatos() {
    return this.dw.catalogoFatos();
  }

  @Get('dw/dimensoes')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:dw:read')
  @ApiOperation({
    summary: 'Data Warehouse — dimensões (DIM_*)',
    description: '`DIM_Clientes`, `DIM_Colaboradores`, `DIM_Turnos`, `DIM_Tempo` — populadas na carga ETL.',
  })
  dwDims() {
    return this.dw.catalogoDimensoes();
  }

  @Post('etl/extrair')
  @UseGuards(AuthGuard('jwt'), RolesGuard, DatahubPipelineGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @ApiOperation({
    summary: 'ETL — extrair (staging read-only Prisma)',
    description:
      '**Pipeline** — Coleta limitada de `clientes`, `solicitacoes` (+ etapas), `faturamento`, `boletos`, `nfsEmitida`, usuários internos e contagem de auditoria.',
  })
  etlExtrair() {
    return this.etl.extrair();
  }

  @Post('etl/transformar')
  @UseGuards(AuthGuard('jwt'), RolesGuard, DatahubPipelineGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @ApiOperation({
    summary: 'ETL — transformar (camada Kimball simulada)',
    description:
      '**Pipeline** — Constrói fatos/dimensões a partir do último `extrair`; falha com 400 se extrair não foi executado.',
  })
  etlTransformar() {
    return this.etl.transformar();
  }

  @Post('etl/carregar')
  @UseGuards(AuthGuard('jwt'), RolesGuard, DatahubPipelineGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @ApiOperation({
    summary: 'ETL — carregar (REFRESH MVs + dimensões)',
    description:
      '**Pipeline** — `REFRESH MATERIALIZED VIEW CONCURRENTLY` nas MVs do Datahub; persiste dimensões e recarrega cache L1.',
  })
  etlCarregar() {
    return this.etl.carregar();
  }

  @Get('quality')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:quality:read')
  @ApiOperation({
    summary: 'Qualidade — métricas rápidas (DQ)',
    description:
      'Duplicidade (ISO), completude, temporalidade, **chaves órfãs** (solicitação×cliente + FK×dim em DW carregado), nota sobre reconciliação.',
  })
  qualityGet() {
    return this.quality.snapshot();
  }

  @Post('quality/verificar')
  @UseGuards(AuthGuard('jwt'), RolesGuard, DatahubPipelineGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @ApiOperation({
    summary: 'Qualidade — verificação profunda + reconciliação',
    description: '**Pipeline** — Snapshot ampliado com reconciliação operação↔faturamento↔fiscal (proxies read-only).',
  })
  qualityPost() {
    return this.quality.verificarProfundo();
  }

  @Get('bi/operacional')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:bi:read')
  @ApiOperation({
    summary: 'BI — painel operacional',
    description:
      'Throughput diário por etapa, ocupação pátio 12 meses, ciclo médio preferencialmente via **IA operacional** (amostras fluxo completo) com fallback em datas de solicitação.',
  })
  biOp() {
    return this.bi.operacional();
  }

  @Get('bi/financeiro')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:bi:read')
  @ApiOperation({
    summary: 'BI — financeiro',
    description: 'Faturamento 12m, margem proxy, inadimplência por cluster sintético, boletos.',
  })
  biFin() {
    return this.bi.financeiro();
  }

  @Get('bi/rh')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:bi:read')
  @ApiOperation({ summary: 'BI — RH / mão de obra (proxy por papel)' })
  biRh() {
    return this.bi.rh();
  }

  @Get('bi/compliance')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:bi:read')
  @ApiOperation({ summary: 'BI — compliance / GRC (auditoria + backlog + score risco proxy)' })
  biComp() {
    return this.bi.compliance();
  }

  @Get('bi/estrategico')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:bi:read')
  @ApiOperation({ summary: 'BI — consolidado estratégico (op + financeiro)' })
  biEst() {
    return this.bi.estrategico();
  }

  @Get('export/fatos')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:export:read')
  @ApiOperation({
    summary: 'Exportação — fatos (JSON ou CSV simulado)',
    description:
      'Paginação (`page`, `limit`), período opcional (`from`, `to`), `formato=json|csv`. **TI/Dados ou ADMIN** (`datahub:export:read`).',
  })
  exportFatos(@Query() q: DatahubPeriodQueryDto) {
    return this.exportSvc.exportFatos(q);
  }

  @Get('export/dimensoes')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:export:read')
  @ApiOperation({
    summary: 'Exportação — dimensões (JSON ou CSV simulado)',
    description: 'Paginação e `dim` opcional; formato `json|csv`. **TI/Dados ou ADMIN.**',
  })
  exportDims(@Query() q: DatahubPeriodQueryDto) {
    return this.exportSvc.exportDimensoes(q);
  }

  @Get('etl/logs')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:obs:read')
  @ApiOperation({
    summary: 'Observabilidade ETL — logs cruzados com Fase 15',
    description: 'Combina execuções do pipeline em memória com logs HTTP filtrados `datahub`.',
  })
  etlLogs() {
    return this.pipelineObs.logsEtl();
  }

  @Get('etl/metricas')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('datahub:obs:read')
  @ApiOperation({
    summary: 'Observabilidade ETL — métricas agregadas',
    description: 'Volume extraído/transformado/carregado, média de duração, falhas; cruza com contadores HTTP globais (Fase 15).',
  })
  etlMetricas() {
    return this.pipelineObs.metricasEtl();
  }
}
