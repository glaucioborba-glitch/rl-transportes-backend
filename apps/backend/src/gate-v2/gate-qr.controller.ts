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
    summary: 'Validar QR unificado (protocolo + token)',
    description:
      'O QR busca os dados atuais da solicitação. Payload: `{ protocolo, token }`. ' +
      'Só vale após aprovação no Gate e dentro da validade configurada. Sem dados financeiros.',
  })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  validarQr(@Query() query: GateValidarQrQueryDto) {
    if (query.payload?.trim()) {
      const parsed = parseQrCredencialPayload(query.payload);
      if (!parsed) {
        throw new ForbiddenException('QR Code inválido.');
      }
      return this.gate.validarQrCredencial(
        parsed.protocolo,
        parsed.container,
        parsed.versao,
        parsed.token,
      );
    }
    if (!query.protocolo?.trim()) {
      throw new BadRequestException('Informe protocolo ou payload do QR.');
    }
    return this.gate.validarQrCredencial(query.protocolo, query.container, query.versao, query.token);
  }
}
