import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PlataformaApiClientStore } from '../stores/plataforma-api-client.store';
import { PlataformaPublicAuthGuard, type PlataformaHttpReq } from '../guards/plataforma-public-auth.guard';
import { PlataformaIpAllowlistGuard } from '../guards/plataforma-ip-allowlist.guard';
import { envelopeOk } from '../common/plataforma-envelope.util';

@ApiTags('plataforma-api-gateway')
@Controller('gateway')
export class PlataformaGatewayController {
  constructor(private readonly clients: PlataformaApiClientStore) {}

  @Get('status')
  @ApiOperation({ summary: 'Status do edge/gateway (sem autenticação)' })
  status() {
    return envelopeOk(
      {
        status: 'operacional',
        versaoApi: 'public/v1',
        timestamp: new Date().toISOString(),
        recursos: ['rate_limit', 'ip_allowlist_opcional', 'hmac_resposta_financeiro'],
      },
      {},
    );
  }

  @Get('limites')
  @ApiSecurity('public-api-key')
  @ApiSecurity('public-api-secret')
  @ApiHeader({ name: 'X-Tenant-ID', required: false })
  @UseGuards(PlataformaIpAllowlistGuard, PlataformaPublicAuthGuard)
  @ApiOperation({ summary: 'Limites efetivos da API Key autenticada' })
  limites(@Req() req: PlataformaHttpReq) {
    const c = req.plataformaCliente!;
    return envelopeOk(
      {
        requestsPorMinuto: c.requestsPerMinute,
        tenantPadrao: c.tenantId,
        servicosContratados: c.servicosHabilitados,
        totalClientesApiRegistrados: this.clients.listar().length,
      },
      { tenantId: req.plataformaTenantId },
    );
  }
}
