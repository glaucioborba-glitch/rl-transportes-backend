import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PlataformaConsumptionStore } from '../stores/plataforma-consumption.store';
import { PlataformaApiClientStore } from '../stores/plataforma-api-client.store';

@ApiTags('plataforma-governanca')
@ApiBearerAuth('access-token')
@Controller('plataforma')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class PlataformaGovernancaController {
  constructor(
    private readonly consumoStore: PlataformaConsumptionStore,
    private readonly clients: PlataformaApiClientStore,
  ) {}

  @Get('consumo')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('plataforma:consumo:read')
  @ApiOperation({ summary: 'Consumo por cliente / parceiro (log em memória)' })
  obterConsumo() {
    return {
      success: true,
      data: {
        porCliente: this.consumoStore.agregarPorCliente(),
        ultimasRequisicoes: this.consumoStore.ultimos(80),
      },
    };
  }

  @Get('estatisticas')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('plataforma:estatisticas:read')
  @ApiOperation({ summary: 'Rotas mais chamadas e perfil de erros' })
  estatisticas() {
    const regs = this.consumoStore.ultimos(5000);
    const err4 = regs.filter((r) => r.statusHttp >= 400 && r.statusHttp < 500).length;
    const err5 = regs.filter((r) => r.statusHttp >= 500).length;
    const latencias = regs.map((r) => r.latencyMs);
    const latMedia = latencias.length
      ? Math.round(latencias.reduce((a, b) => a + b, 0) / latencias.length)
      : 0;
    return {
      success: true,
      data: {
        rotasTop: this.consumoStore.rotasMaisChamadas(15),
        erros4xx: err4,
        erros5xx: err5,
        latenciaMediaExternaMs: latMedia,
        apiClientsRegistrados: this.clients.listar().length,
      },
    };
  }

  @Get('seguranca')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('plataforma:seguranca:read')
  @ApiOperation({ summary: 'Incidentes de autenticação e segurança periférica' })
  seguranca() {
    return {
      success: true,
      data: {
        incidentesRecentes: this.consumoStore.incidentes(40),
        hmacAtivo: !!(process.env.PLATAFORMA_HMAC_SECRET ?? '').trim(),
        ipAllowlistAtiva: !!(process.env.PLATAFORMA_GATEWAY_IP_ALLOWLIST ?? '').trim(),
      },
    };
  }
}
