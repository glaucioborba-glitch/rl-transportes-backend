import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CadastrosTerceirosDocumentosService } from './cadastros-terceiros-documentos.service';
import { CadastrosTerceirosService } from './cadastros-terceiros.service';
import { CadastrosTerceiroFormDto } from './dto/cadastros-terceiro-form.dto';

const CADASTROS_ROLES = [Role.ADMIN, Role.GERENTE] as const;

@ApiTags('cadastros')
@ApiBearerAuth('access-token')
@Controller('v2/cadastros/terceiros')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...CADASTROS_ROLES)
export class CadastrosTerceirosController {
  constructor(
    private readonly service: CadastrosTerceirosService,
    private readonly documentos: CadastrosTerceirosDocumentosService,
  ) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.service.list(search);
  }

  @Post('documentos')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  extrair(
    @UploadedFile() arquivo: Express.Multer.File,
    @Body('tipo') tipo: string,
    @Body('terceiroId') terceiroId?: string,
    @Body('indice') indice?: string,
  ) {
    return this.documentos.extrair({ file: arquivo, tipo, terceiroId, indice });
  }

  @Get('documentos/:docId/arquivo')
  async arquivo(@Param('docId') docId: string, @Res() res: Response) {
    const out = await this.documentos.baixar(docId);
    const safeName = out.filename.replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(out.buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CadastrosTerceiroFormDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CadastrosTerceiroFormDto) {
    return this.service.update(id, dto);
  }
}
