import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  StreamableFile,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { canonicalMediaKey } from '../common/storage/safe-local-path.util';
import { Public } from '../common/decorators/public.decorator';
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
  @Public()
  @Header('Cache-Control', 'private, max-age=300')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({
    summary: 'Servir foto local de vistoria (URL assinada, TTL 1h — equivalente a S3 presigned)',
  })
  serveLocal(
    @Param('path') storageKey: string | string[],
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
  ): StreamableFile {
    const key = canonicalMediaKey(Array.isArray(storageKey) ? storageKey.join('/') : storageKey);
    if (!this.storage.verifyLocalMediaAccess(key, exp, sig)) {
      throw new UnauthorizedException('Link de mídia inválido ou expirado');
    }
    const { buffer, mimeType } = this.storage.readLocalFile(key);
    return new StreamableFile(buffer, {
      type: mimeType,
      disposition: 'inline',
    });
  }
}
