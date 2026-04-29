import { Controller, Get, NotFoundException, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { PlataformaPublicAuthGuard } from '../guards/plataforma-public-auth.guard';
import { PlataformaIpAllowlistGuard } from '../guards/plataforma-ip-allowlist.guard';
import { PlataformaConsumoInterceptor } from '../interceptors/plataforma-consumo.interceptor';
import { PlataformaMarketplaceService } from '../services/plataforma-marketplace.service';
import { assertCliente, envelopeOk } from '../common/plataforma-envelope.util';
import type { PlataformaApiClient } from '../plataforma.types';
import { PlataformaClient, PlataformaTenantHeader } from '../decorators/plataforma-client.decorator';

@ApiTags('plataforma-marketplace')
@ApiSecurity('public-api-key')
@ApiSecurity('public-api-secret')
@ApiHeader({ name: 'X-Tenant-ID', required: false })
@Controller('marketplace')
@UseGuards(PlataformaIpAllowlistGuard, PlataformaPublicAuthGuard)
@UseInterceptors(PlataformaConsumoInterceptor)
export class PlataformaMarketplaceCatalogController {
  constructor(private readonly marketplace: PlataformaMarketplaceService) {}

  @Get('servicos')
  @ApiOperation({ summary: 'Catálogo B2B de serviços logísticos digitais (read-only)' })
  async list(
    @PlataformaClient() client: PlataformaApiClient | undefined,
    @PlataformaTenantHeader() tenant: string | undefined,
  ) {
    assertCliente(client);
    return envelopeOk(this.marketplace.listarServicos(), { tenantId: tenant ?? client.tenantId });
  }

  @Get('servicos/:id')
  @ApiOperation({ summary: 'Detalhe de um serviço do marketplace' })
  async one(
    @Param('id') id: string,
    @PlataformaClient() client: PlataformaApiClient | undefined,
    @PlataformaTenantHeader() tenant: string | undefined,
  ) {
    assertCliente(client);
    const s = this.marketplace.obterServico(id);
    if (!s) throw new NotFoundException({ success: false, error: { code: 'NOT_FOUND', message: 'Serviço inexistente.' } });
    return envelopeOk(s, { tenantId: tenant ?? client.tenantId });
  }
}
