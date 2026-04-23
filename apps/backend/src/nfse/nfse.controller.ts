import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { NfseService } from './nfse.service';

@ApiTags('nfse')
@ApiBearerAuth('access-token')
@Controller('nfse')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class NfseController {
  constructor(private readonly nfseService: NfseService) {}

  @Get(':identificador')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('nfse:consultar')
  consultar(
    @Param('identificador') identificador: string,
    @CurrentUser() user: AuthUser,
    @Request() req: { ip?: string; get: (h: string) => string | undefined; user: { sub: string } },
  ) {
    const ip = (req as { ip?: string }).ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.nfseService.consultarPorAutenticidade(
      identificador,
      user,
      user.id,
      ip,
      userAgent,
    );
  }
}
