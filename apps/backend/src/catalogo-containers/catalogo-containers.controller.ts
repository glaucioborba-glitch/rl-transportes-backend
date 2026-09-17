import {
  BadRequestException,
  Controller,
  Get,
  Param,
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
import { CatalogoContainersService } from './catalogo-containers.service';

@ApiTags('catalogo-containers')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('v2/catalogo-containers')
export class CatalogoContainersController {
  constructor(private readonly catalogo: CatalogoContainersService) {}

  @Get(':iso')
  @Roles(
    Role.ADMIN,
    Role.GERENTE,
    Role.OPERADOR_GATE,
    Role.OPERADOR_PORTARIA,
    Role.OPERADOR_PATIO,
    Role.SUPER_ADMIN,
  )
  @Permissions('solicitacoes:ler')
  @ApiOperation({ summary: 'Lookup do catálogo físico da caixa (autofill intranet)' })
  buscar(@Param('iso') iso: string) {
    return this.catalogo.buscar(iso);
  }
}

@ApiTags('super-admin')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('super-admin/catalogo-containers')
export class CatalogoContainersSuperAdminController {
  constructor(private readonly catalogo: CatalogoContainersService) {}

  @Get('modelo')
  @ApiOperation({ summary: 'Modelo .xls para importar o catálogo físico' })
  modelo(@Res() res: Response) {
    const file = this.catalogo.modeloImportacao();
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Get()
  @ApiOperation({ summary: 'Lista do catálogo físico compartilhado entre terminais' })
  listar(@Query('q') q?: string) {
    return this.catalogo.listar(q);
  }

  @Post('importar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Importa ISO, tipo, tamanho e pesos a partir de .xls/.xlsx' })
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
