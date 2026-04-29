import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlataformaContractsService } from '../services/plataforma-contracts.service';

@ApiTags('plataforma-api-contracts')
@Controller('api-contracts/v1')
export class PlataformaContractsController {
  constructor(private readonly contracts: PlataformaContractsService) {}

  @Get('schemas/:nome')
  @ApiOperation({ summary: 'JSON Schema (draft-07) do recurso público ou webhook' })
  schema(@Param('nome') nome: string) {
    return this.contracts.obterSchema(nome);
  }

  @Get('webhooks')
  @ApiOperation({ summary: 'Contratos de eventos para webhooks de parceiros' })
  webhooks() {
    return { success: true, data: this.contracts.webhookContratos() };
  }
}
