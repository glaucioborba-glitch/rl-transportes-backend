import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditoriaQueryDto } from './dto/auditoria-query.dto';
import { AuditoriaService } from './auditoria.service';

@ApiTags('auditoria')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('auditoria:ler')
  listar(
    @Query() query: AuditoriaQueryDto,
    @CurrentUser('id') consultorId: string,
    @Request() req: { ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = (req as { ip?: string }).ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.auditoriaService.buscarComFiltrosComAuditoria(query, consultorId, ip, userAgent);
  }

  @Get('registro/:tabela/:registroId')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('auditoria:ler')
  historicoRegistro(
    @Param('tabela') tabela: string,
    @Param('registroId') registroId: string,
    @CurrentUser('id') consultorId: string,
    @Request() req: { ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = (req as { ip?: string }).ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.auditoriaService.buscarPorRegistroComAuditoria(
      tabela,
      registroId,
      consultorId,
      ip,
      userAgent,
    );
  }

  @Get('usuario/:userId')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('auditoria:ler')
  historicoUsuario(
    @Param('userId') userId: string,
    @Query('limite') limite: string | undefined,
    @CurrentUser('id') consultorId: string,
    @Request() req: { ip?: string; get: (h: string) => string | undefined },
  ) {
    const n = limite ? parseInt(limite, 10) : 100;
    const take = Number.isFinite(n) && n > 0 && n <= 500 ? n : 100;
    const ip = (req as { ip?: string }).ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.auditoriaService.buscarPorUsuarioComAuditoria(
      userId,
      take,
      consultorId,
      ip,
      userAgent,
    );
  }
}
