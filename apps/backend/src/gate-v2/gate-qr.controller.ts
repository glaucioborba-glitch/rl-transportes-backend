import { Controller, BadRequestException, ForbiddenException, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { GateValidarQrQueryDto } from './dto/gate-validar-qr-query.dto';
import { parseQrCredencialPayload } from './gate-qr-payload.util';
import { GateV2Service } from './gate.service';

const GATE_ROLES: Role[] = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
];

/**
 * Superfície `/gate/*` para integrações de portaria (alias operacional).
 * Compatível com leitores que consumirão `GET /gate/validar-qr?protocolo=…&container=…`.
 */
@ApiTags('gate')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('gate')
export class GateQrController {
  constructor(private readonly gate: GateV2Service) {}

  @Get('validar-qr')
  @ApiOperation({
    summary: 'Validar credencial QR do motorista (protocolo + container + versão)',
    description:
      'Busca solicitação pelo protocolo do QR. Payload JSON: `{ protocolo, versao, containers, … }`. ' +
      'Alternativa: query `protocolo`, `container`, `versao` ou `payload` (JSON bruto). Sem dados financeiros.',
  })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  validarQr(@Query() query: GateValidarQrQueryDto) {
    if (query.payload?.trim()) {
      const parsed = parseQrCredencialPayload(query.payload);
      if (!parsed) {
        throw new ForbiddenException(
          'QR Code desatualizado ou inválido. Uma alteração foi feita nesta solicitação. Exija a nova credencial gerada no portal.',
        );
      }
      return this.gate.validarQrCredencial(parsed.protocolo, parsed.container, parsed.versao);
    }
    if (!query.protocolo?.trim()) {
      throw new BadRequestException('Informe protocolo ou payload do QR.');
    }
    return this.gate.validarQrCredencial(query.protocolo, query.container, query.versao);
  }
}
