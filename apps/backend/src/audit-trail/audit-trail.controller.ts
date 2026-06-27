import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request, Response } from 'express';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DEFAULT_TENANT_ID } from '../tenant/tenant.constants';
import { AuditTrailService } from './audit-trail.service';
import { AuditTrailExportQueryDto, AuditTrailQueryDto } from './dto/audit-trail-query.dto';

@ApiTags('audit-trail')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN, Role.GERENTE)
@Permissions('auditoria:ler')
@Controller('audit-trail')
export class AuditTrailController {
  constructor(private readonly auditTrail: AuditTrailService) {}

  @Get()
  @ApiOperation({ summary: 'Linha do tempo narrativa de auditoria (busca por contêiner, usuário ou protocolo)' })
  list(@Req() req: Request & { tenantId?: string }, @Query() query: AuditTrailQueryDto) {
    const tenantId = req.tenantId ?? DEFAULT_TENANT_ID;
    return this.auditTrail.list(tenantId, query);
  }

  @Get('usuarios')
  @ApiOperation({ summary: 'Usuários distintos nos logs (filtro avançado)' })
  usuarios(@Req() req: Request & { tenantId?: string }) {
    return this.auditTrail.listUsuarios(req.tenantId ?? DEFAULT_TENANT_ID);
  }

  @Get('acoes')
  @ApiOperation({ summary: 'Ações distintas nos logs (filtro avançado)' })
  acoes(@Req() req: Request & { tenantId?: string }) {
    return this.auditTrail.listAcoes(req.tenantId ?? DEFAULT_TENANT_ID);
  }

  @Get('export')
  @ApiOperation({ summary: 'Exportar relatório CSV (Excel) com selo do terminal' })
  async exportCsv(
    @Req() req: Request & { tenantId?: string },
    @Query() query: AuditTrailExportQueryDto,
    @Res({ passthrough: false }) res: Response,
  ) {
    const tenantId = req.tenantId ?? DEFAULT_TENANT_ID;
    const items = await this.auditTrail.export(tenantId, query);
    const csv = this.auditTrail.buildCsv(items);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-trail-${tenantId}-${stamp}.csv"`,
    );
    res.send(csv);
  }
}
