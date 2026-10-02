import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DEFAULT_TENANT_ID } from '../tenant/tenant.constants';
import { CnabService } from './cnab.service';

const FINANCEIRO_ROLES = [Role.ADMIN, Role.GERENTE];

@ApiTags('financeiro-cnab')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...FINANCEIRO_ROLES)
@Permissions('dashboard:financeiro')
@Controller('financeiro/cnab')
export class CnabController {
  constructor(private readonly cnab: CnabService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de arquivo de retorno bancário CNAB (.txt / .RET)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = file.originalname?.split('.').pop()?.toLowerCase() ?? '';
        if (!['txt', 'ret'].includes(ext)) {
          cb(new BadRequestException('Somente arquivos .txt ou .RET'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request & { tenantId?: string },
  ) {
    const tenantId = req.tenantId ?? DEFAULT_TENANT_ID;
    return this.cnab.uploadRetorno(tenantId, file);
  }

  @Get('arquivos')
  @ApiOperation({ summary: 'Histórico de arquivos CNAB processados' })
  listar(
    @Req() req: Request & { tenantId?: string },
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.tenantId ?? DEFAULT_TENANT_ID;
    const n = limit ? parseInt(limit, 10) : 50;
    return this.cnab.listarHistorico(tenantId, Number.isFinite(n) ? n : 50);
  }
}
