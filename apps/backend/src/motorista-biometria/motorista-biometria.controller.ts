import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { EnrollMotoristaBiometriaDto } from './dto/enroll-motorista-biometria.dto';
import { MotoristaBiometriaService } from './motorista-biometria.service';

const BIO_ROLES: Role[] = [Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE, Role.SUPER_ADMIN];

@ApiTags('gate-biometria')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('v2/gate/biometria')
export class MotoristaBiometriaController {
  constructor(private readonly biometria: MotoristaBiometriaService) {}

  @Get(':cpf')
  @Roles(...BIO_ROLES)
  @Permissions('solicitacoes:gate')
  @ApiOperation({ summary: 'Status da digital do motorista (CPF) neste terminal' })
  status(@Param('cpf') cpf: string, @CurrentUser() user: AuthUser) {
    return this.biometria.status(user.tenantId ?? 'default', cpf);
  }

  @Put(':cpf')
  @Roles(...BIO_ROLES)
  @Permissions('solicitacoes:gate')
  @ApiOperation({ summary: 'Grava o template FIR capturado no PC do Gate' })
  enroll(
    @Param('cpf') cpf: string,
    @Body() body: EnrollMotoristaBiometriaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.biometria.enroll(user.tenantId ?? 'default', cpf, body.firText, user.id);
  }

  @Delete(':cpf')
  @Roles(...BIO_ROLES)
  @Permissions('solicitacoes:gate')
  @ApiOperation({ summary: 'Remove a digital cadastrada (novo cadastro no leitor)' })
  remove(@Param('cpf') cpf: string, @CurrentUser() user: AuthUser) {
    return this.biometria.remove(user.tenantId ?? 'default', cpf);
  }
}
