import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CatalogoNaviosService } from './catalogo-navios.service';

@ApiTags('catalogo-navios')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('v2/catalogo-navios')
export class CatalogoNaviosController {
  constructor(private readonly catalogo: CatalogoNaviosService) {}

  @Get()
  @Roles(
    Role.ADMIN,
    Role.GERENTE,
    Role.OPERADOR_GATE,
    Role.OPERADOR_PORTARIA,
    Role.OPERADOR_PATIO,
    Role.SUPER_ADMIN,
  )
  @Permissions('solicitacoes:ler')
  @ApiOperation({ summary: 'Autocomplete de navios (catálogo compartilhado)' })
  listar(@Query('q') q?: string) {
    return this.catalogo.listar(q, 80);
  }
}

@ApiTags('super-admin')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/catalogo-navios')
export class CatalogoNaviosSuperAdminController {
  constructor(private readonly catalogo: CatalogoNaviosService) {}

  @Get('modelo')
  @ApiOperation({ summary: 'Modelo .xls para importar o catálogo de navios' })
  modelo(@Res() res: Response) {
    const file = this.catalogo.modeloImportacao();
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Get()
  @ApiOperation({ summary: 'Lista do catálogo de navios compartilhado entre terminais' })
  listar(@Query('q') q?: string) {
    return this.catalogo.listar(q, 500);
  }

  @Post('importar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Importa nomes de navios a partir de .xls/.xlsx' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = file.originalname?.split('.').pop()?.toLowerCase() ?? '';
        if (!['xls', 'xlsx', 'csv'].includes(ext)) {
          cb(new BadRequestException('Somente arquivos .xls, .xlsx ou .csv'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  importar(@UploadedFile() file: Express.Multer.File) {
    return this.catalogo.importarPlanilha(file);
  }
}
