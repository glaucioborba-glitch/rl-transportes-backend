import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtPortalAuthGuard } from '../cx-portais/guards/jwt-portal.guard';
import { VistoriaService } from './vistoria.service';

@ApiTags('portal-vistoria')
@ApiBearerAuth('portal-token')
@UseGuards(JwtPortalAuthGuard)
@Controller('cliente/portal/solicitacoes')
export class VistoriaPortalController {
  constructor(private readonly vistoria: VistoriaService) {}

  @Get(':id/vistorias')
  @ApiOperation({ summary: 'Galeria de vistorias gate (entrada/saída) — dossiê jurídico' })
  listPortal(@Param('id') solicitacaoId: string) {
    return this.vistoria.listBySolicitacao(solicitacaoId);
  }
}
