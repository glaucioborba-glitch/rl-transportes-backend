import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth.service';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SessionService } from './session.service';

@ApiTags('auth')
@Controller('auth')
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Ordem: rota estática `auditoria` antes de `:sessionId` evita colisão com UUID chamado "auditoria".
   */
  @Get('sessoes-ativas/auditoria')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Permissions('auth:sessao')
  @ApiOperation({ summary: 'Histórico recente de auditoria de dispositivo (últimas 100)' })
  auditoriaDispositivos(@CurrentUser() user: AuthUser) {
    return this.sessionService.getDeviceAudit(user.id, 100);
  }

  @Get('sessoes-ativas')
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Permissions('auth:sessao')
  @ApiOperation({ summary: 'Sessões ativas enriquecidas (Redis + última auditoria)' })
  sessoesAtivas(@CurrentUser() user: AuthUser) {
    return this.sessionService.getActiveSessions(user.id);
  }

  @Delete('sessoes-ativas/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
  @Permissions('auth:sessao')
  @ApiOperation({ summary: 'Encerrar sessão específica (outro dispositivo)' })
  async encerrarSessao(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.authService.revokeOwnSession(user.id, sessionId);
  }
}
