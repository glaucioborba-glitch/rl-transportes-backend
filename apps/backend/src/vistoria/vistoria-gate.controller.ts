import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { VistoriaStorageService } from './vistoria-storage.service';
import { VistoriaService } from './vistoria.service';

const GATE_ROLES: Role[] = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
];

@ApiTags('vistoria-gate')
@Controller('v2/gate/vistoria')
export class VistoriaGateController {
  constructor(
    private readonly vistoria: VistoriaService,
    private readonly storage: VistoriaStorageService,
  ) {}

  @Get('solicitacoes/:solicitacaoId')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @ApiBearerAuth('access-token')
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  @ApiOperation({ summary: 'Listar vistorias fotográficas da solicitação' })
  listStaff(@Param('solicitacaoId') solicitacaoId: string) {
    return this.vistoria.listBySolicitacao(solicitacaoId);
  }

  @Get('media/*path')
  @ApiOperation({ summary: 'Servir foto local de vistoria (dev / fallback)' })
  serveLocal(@Param('path') storageKey: string | string[], @Res() res: Response) {
    const key = Array.isArray(storageKey) ? storageKey.join('/') : storageKey;
    const decoded = decodeURIComponent(key);
    const { buffer, mimeType } = this.storage.readLocalFile(decoded);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  }
}
