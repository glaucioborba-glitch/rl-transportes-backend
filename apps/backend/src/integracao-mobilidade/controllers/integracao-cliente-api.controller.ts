import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { IntegracaoClienteIdParam } from '../decorators/integracao-cliente-id.decorator';
import { ClienteApiAuthGuard } from '../guards/cliente-api-auth.guard';
import { IntegracaoClienteApiService } from '../services/integracao-cliente-api.service';

@ApiTags('integracao-cliente-api')
@ApiSecurity('api-key')
@ApiBearerAuth('access-token')
@UseGuards(ClienteApiAuthGuard)
@Controller('cliente-api')
export class IntegracaoClienteApiController {
  constructor(private readonly svc: IntegracaoClienteApiService) {}

  @Get('solicitacoes')
  @ApiOperation({
    summary: 'Listar solicitacoes do cliente (B2B tracking)',
    description:
      'Autenticacao: cabecalho X-Api-Key (maquina) ou JWT de usuario CLIENTE. Rate limit por cliente.',
  })
  async list(@IntegracaoClienteIdParam() clienteId: string) {
    return this.svc.listSolicitacoes(clienteId);
  }

  @Get('solicitacoes/:id')
  @ApiOperation({ summary: 'Detalhe de solicitacao com timestamps operacionais' })
  async getOne(@IntegracaoClienteIdParam() clienteId: string, @Param('id') id: string) {
    return this.svc.getById(clienteId, id);
  }

  @Get('slas')
  @ApiOperation({ summary: 'Metricas agregadas de SLA (amostras concluidas)' })
  async slas(@IntegracaoClienteIdParam() clienteId: string) {
    return this.svc.metricsSlas(clienteId);
  }

  @Get('eventos')
  @ApiOperation({ summary: 'Eventos recentes do barramento filtrados ao cliente' })
  eventos(@IntegracaoClienteIdParam() clienteId: string) {
    return this.svc.recentEvents(clienteId);
  }
}
