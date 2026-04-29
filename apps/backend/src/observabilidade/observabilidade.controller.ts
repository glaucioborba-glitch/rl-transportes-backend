import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { ObservabilidadeTelemetryStore } from './observabilidade-telemetry.store';
import { ObservabilidadeService } from './observabilidade.service';
import { ObservabilidadeHealthService } from './observabilidade-health.service';
import { ObservabilidadeAccessGuard } from './observabilidade-access.guard';
import { ObservabilidadeLogsQueryDto } from './dto/observabilidade-logs-query.dto';
import { CreateObservabilidadeAlertaDto } from './dto/create-observabilidade-alerta.dto';
import { ObservabilidadeAlertasAdminOnly } from './observabilidade-metadata';

@ApiTags('observabilidade')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), ObservabilidadeAccessGuard)
@Controller('observabilidade')
export class ObservabilidadeController {
  constructor(
    private readonly store: ObservabilidadeTelemetryStore,
    private readonly svc: ObservabilidadeService,
    private readonly health: ObservabilidadeHealthService,
  ) {}

  @Get('logs')
  @ApiOperation({
    summary: 'Logs estruturados (buffer em memória)',
    description:
      'Campos JSON padronizados; emails mascarados; sem secrets; correlacionado por requestId.',
  })
  logs(@Query() q: ObservabilidadeLogsQueryDto) {
    return this.store.listLogs({
      origem: q.origem,
      severidade: q.severidade,
      limit: q.limit,
    });
  }

  @Get('metricas')
  @ApiProduces('text/plain')
  @ApiOperation({
    summary: 'Métricas Prometheus (text/plain)',
    description:
      'Latência por rota, throughput agregado, memória do processo; ping DB/Redis quando disponível.',
  })
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metricas(): Promise<string> {
    return this.svc.getPrometheusBody();
  }

  @Get('tracing')
  @ApiOperation({
    summary: 'Tracing distribuído (APM sintético)',
    description:
      'Spans inferidos por requisição HTTP sem instrumentar outros módulos. Query requestId opcional.',
  })
  tracing(@Query('requestId') requestId?: string) {
    if (requestId) {
      const t = this.store.getTrace(requestId);
      return t ? [t] : [];
    }
    return this.store.listTraces(80);
  }

  @Get('health')
  @ApiOkResponse({ description: 'Health resumido observabilidade' })
  @ApiOperation({ summary: 'Saúde sintética (OK/DEGRADED/FAIL)' })
  healthResumo() {
    return this.health.simples();
  }

  @Get('health/detalhado')
  @ApiOperation({ summary: 'Health detalhado (DB, Redis, processo, proxies env)' })
  healthDetalhado() {
    return this.health.detalhado();
  }

  @Post('alertas')
  @HttpCode(HttpStatus.CREATED)
  @ObservabilidadeAlertasAdminOnly()
  @ApiOperation({
    summary: 'Registrar alerta (somente memória; sem integração externa)',
    description: 'Exige papel ADMIN.',
  })
  criarAlerta(@Body() dto: CreateObservabilidadeAlertaDto) {
    return this.store.registrarAlerta({
      tipo: dto.tipo,
      severidade: dto.severidade,
      mensagem: dto.mensagem,
      requestId: dto.requestId,
      metadata: dto.metadata,
    });
  }

  @Get('alertas')
  @ApiOperation({ summary: 'Listar alertas recentes' })
  listarAlertas() {
    return this.store.listAlertas(200);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Painel Analytics 360º (executivo)',
    description: 'KPIs derivados do buffer de telemetria em memória.',
  })
  dashboard() {
    return this.svc.getDashboard();
  }
}
