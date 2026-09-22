import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { UnidadeProcessoServicosService } from './unidade-processo-servicos.service';

const STAFF_ROLES = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
] as const;

class LancarServicoDto {
  @IsUUID()
  servicoItemId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantidade!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lacre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  origemLacre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  isoDestino?: string;
}

class ExcluirHandlingAutomaticoDto {
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  motivo!: string;

  @IsString()
  @MinLength(11)
  @MaxLength(18)
  documento!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

@ApiTags('unidade-processo')
@ApiBearerAuth('access-token')
@Controller('v2/unidade-processos')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Roles(...STAFF_ROLES)
export class UnidadeProcessoController {
  constructor(private readonly servicos: UnidadeProcessoServicosService) {}

  @Get('catalogo-servicos')
  catalogo(@Query('unidadeProcessoId') unidadeProcessoId?: string) {
    return this.servicos.catalogo(unidadeProcessoId);
  }

  @Get(':id/servicos')
  listar(@Param('id') id: string) {
    return this.servicos.listar(id);
  }

  @Get(':id/servicos/:lancamentoId/anexo')
  async baixarAnexo(
    @Param('id') id: string,
    @Param('lancamentoId') lancamentoId: string,
    @Res() res: Response,
  ) {
    const out = await this.servicos.baixarAnexoExclusao(id, lancamentoId);
    const safeName = out.filename.replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(out.buffer);
  }

  @Post(':id/servicos')
  @HttpCode(HttpStatus.CREATED)
  lancar(@Param('id') id: string, @Body() dto: LancarServicoDto, @CurrentUser() user: AuthUser) {
    return this.servicos.lancar(id, dto, user.id);
  }

  @Post(':id/servicos/:lancamentoId/excluir-automatico')
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(
    FileInterceptor('anexo', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  excluirHandling(
    @Param('id') id: string,
    @Param('lancamentoId') lancamentoId: string,
    @Body() dto: ExcluirHandlingAutomaticoDto,
    @CurrentUser() user: AuthUser,
    @UploadedFile() anexo?: Express.Multer.File,
  ) {
    return this.servicos.excluirHandlingAutomatico(
      id,
      lancamentoId,
      dto,
      user.id || user.sub,
      anexo,
    );
  }

  @Delete(':id/servicos/:lancamentoId')
  remover(@Param('id') id: string, @Param('lancamentoId') lancamentoId: string) {
    return this.servicos.remover(id, lancamentoId);
  }
}
