import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PlataformaIpAllowlistGuard } from '../guards/plataforma-ip-allowlist.guard';
import { PlataformaPublicAuthGuard } from '../guards/plataforma-public-auth.guard';
import { PlataformaConsumoInterceptor } from '../interceptors/plataforma-consumo.interceptor';
import { PlataformaHmacResponseInterceptor } from '../interceptors/plataforma-hmac-response.interceptor';
import { PlataformaPublicDataService } from '../plataforma-public-data.service';
import { PlataformaServico } from '../decorators/plataforma-servico.decorator';
import { PlataformaClient, PlataformaTenantHeader } from '../decorators/plataforma-client.decorator';
import { assertCliente, envelopeOk } from '../common/plataforma-envelope.util';
import type { PlataformaApiClient } from '../plataforma.types';

@ApiTags('plataforma-public-v1')
@ApiSecurity('public-api-key')
@ApiSecurity('public-api-secret')
@ApiHeader({
  name: 'X-Tenant-ID',
  required: false,
  description: 'Contexto multi-terminal; fallback no tenant da API Key.',
})
@Controller('public/v1')
@UseGuards(PlataformaIpAllowlistGuard, PlataformaPublicAuthGuard)
@UseInterceptors(PlataformaConsumoInterceptor)
export class PlataformaPublicV1Controller {
  constructor(private readonly data: PlataformaPublicDataService) {}

  @Get('solicitacoes')
  @PlataformaServico('tracking_operacional')
  @ApiOperation({ summary: 'Listar solicitações (read-only, particionado por tenant/API Key)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listSolic(
    @PlataformaClient() client: PlataformaApiClient | undefined,
    @PlataformaTenantHeader() tenant: string | undefined,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Req() req?: Request,
  ) {
    assertCliente(client);
    const body = await this.data.listarSolicitacoes(client, tenant, Number(page) || 1, Number(limit) || 20);
    const rid = req?.headers['x-request-id'];
    return envelopeOk(body, {
      tenantId: tenant ?? client.tenantId,
      requestId: typeof rid === 'string' ? rid : undefined,
    });
  }

  @Get('solicitacoes/:id')
  @PlataformaServico('tracking_operacional')
  @ApiOperation({ summary: 'Detalhe de solicitação + etapas operacionais' })
  async getSolic(
    @Param('id') id: string,
    @PlataformaClient() client: PlataformaApiClient | undefined,
    @PlataformaTenantHeader() tenant: string | undefined,
    @Req() req?: Request,
  ) {
    assertCliente(client);
    const row = await this.data.obterSolicitacao(id, client, tenant);
    if (!row) {
      throw new NotFoundException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Solicitação não encontrada ou fora do escopo do tenant.' },
      });
    }
    const rid = req?.headers['x-request-id'];
    return envelopeOk(row, {
      tenantId: tenant ?? client.tenantId,
      requestId: typeof rid === 'string' ? rid : undefined,
    });
  }

  @Get('eventos')
  @PlataformaServico('eventos_fiscal_financeiro')
  @ApiOperation({ summary: 'Feed de eventos (proxy em auditoria — read-only)' })
  @ApiQuery({ name: 'limit', required: false })
  async eventos(
    @PlataformaClient() client: PlataformaApiClient | undefined,
    @PlataformaTenantHeader() tenant: string | undefined,
    @Query('limit') limit?: number,
  ) {
    assertCliente(client);
    const body = await this.data.listarEventos(client, tenant, Number(limit) || 50);
    return envelopeOk(body, { tenantId: tenant ?? client.tenantId });
  }

  @Get('slas')
  @PlataformaServico('sla_service')
  @ApiOperation({ summary: 'SLA-as-a-service (config do tenant + proxy 30 dias)' })
  async slas(
    @PlataformaClient() client: PlataformaApiClient | undefined,
    @PlataformaTenantHeader() tenant: string | undefined,
  ) {
    assertCliente(client);
    return envelopeOk(await this.data.slasProxy(client, tenant), { tenantId: tenant ?? client.tenantId });
  }

  @Get('containers')
  @PlataformaServico('patio_tempo_real')
  @ApiOperation({ summary: 'Unidades / containers vinculados a solicitações' })
  async containers(
    @PlataformaClient() client: PlataformaApiClient | undefined,
    @PlataformaTenantHeader() tenant: string | undefined,
    @Query('limit') limit?: number,
  ) {
    assertCliente(client);
    return envelopeOk(await this.data.listarContainers(client, tenant, Number(limit) || 40), {
      tenantId: tenant ?? client.tenantId,
    });
  }

  @Get('operacoes')
  @PlataformaServico('produtividade_stats')
  @ApiOperation({ summary: 'Resumo operacional / produtividade (contagens + ciclo médio)' })
  async ops(
    @PlataformaClient() client: PlataformaApiClient | undefined,
    @PlataformaTenantHeader() tenant: string | undefined,
  ) {
    assertCliente(client);
    return envelopeOk(await this.data.operacoesResumo(client, tenant), { tenantId: tenant ?? client.tenantId });
  }

  @Get('nfse')
  @PlataformaServico('eventos_fiscal_financeiro')
  @UseInterceptors(PlataformaHmacResponseInterceptor)
  @ApiOperation({ summary: 'Notas fiscais emitidas (sem XML na resposta pública)' })
  @ApiQuery({ name: 'limit', required: false })
  async nfse(
    @PlataformaClient() client: PlataformaApiClient | undefined,
    @PlataformaTenantHeader() tenant: string | undefined,
    @Query('limit') limit?: number,
  ) {
    assertCliente(client);
    return envelopeOk(await this.data.listarNfse(client, tenant, Number(limit) || 30), {
      tenantId: tenant ?? client.tenantId,
    });
  }

  @Get('faturamento')
  @PlataformaServico('faturamento_pagamentos')
  @UseInterceptors(PlataformaHmacResponseInterceptor)
  @ApiOperation({ summary: 'Faturamento e boletos (read-only)' })
  @ApiQuery({ name: 'limit', required: false })
  async fat(
    @PlataformaClient() client: PlataformaApiClient | undefined,
    @PlataformaTenantHeader() tenant: string | undefined,
    @Query('limit') limit?: number,
  ) {
    assertCliente(client);
    return envelopeOk(await this.data.listarFaturamento(client, tenant, Number(limit) || 30), {
      tenantId: tenant ?? client.tenantId,
    });
  }
}
