import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
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
  listar(@Query() query: AuditoriaQueryDto) {
    return this.auditoriaService.buscarComFiltros(query);
  }

  @Get('registro/:tabela/:registroId')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('auditoria:ler')
  historicoRegistro(
    @Param('tabela') tabela: string,
    @Param('registroId') registroId: string,
  ) {
    return this.auditoriaService.buscarPorRegistro(tabela, registroId);
  }

  @Get('usuario/:userId')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('auditoria:ler')
  historicoUsuario(
    @Param('userId') userId: string,
    @Query('limite') limite?: string,
  ) {
    const n = limite ? parseInt(limite, 10) : 100;
    const take = Number.isFinite(n) && n > 0 && n <= 500 ? n : 100;
    return this.auditoriaService.buscarPorUsuario(userId, take);
  }
}
