import { Controller, ForbiddenException, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCxUser } from '../cx-portais/decorators/current-cx-user.decorator';
import { JwtPortalAuthGuard } from '../cx-portais/guards/jwt-portal.guard';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import { VistoriaService } from './vistoria.service';

@ApiTags('portal-vistoria')
@ApiBearerAuth('portal-token')
@UseGuards(JwtPortalAuthGuard)
@Controller('cliente/portal/solicitacoes')
export class VistoriaPortalController {
  constructor(private readonly vistoria: VistoriaService) {}

  @Get(':id/vistorias')
  @ApiOperation({ summary: 'Galeria de vistorias gate (entrada/saída) — dossiê jurídico' })
  listPortal(@Param('id') solicitacaoId: string, @CurrentCxUser() cx: CxPortalRequestUser) {
    if (cx.portalPapel === 'STAFF') {
      return this.vistoria.listBySolicitacao(solicitacaoId, { tenantId: cx.tenantId });
    }
    if (!cx.clienteId?.trim()) {
      throw new ForbiddenException('Usuário portal sem vínculo de cliente');
    }
    return this.vistoria.listBySolicitacao(solicitacaoId, { clienteId: cx.clienteId });
  }
}
