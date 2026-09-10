import { Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CessaoTitularidadeService } from './cessao-titularidade.service';
import {
  CessaoAutorizacaoGerenteDto,
  ConfirmarReemissaoCessaoDto,
  ExecutarCessaoDto,
} from './dto/cessao-titularidade.dto';

@ApiTags('cessao-titularidade')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('v2/gate/cessao-titularidade')
export class CessaoTitularidadeController {
  constructor(private readonly cessao: CessaoTitularidadeService) {}

  @Get('pendencias-nfse')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:ler')
  @ApiOperation({ summary: 'Cessões aguardando cancelamento de NFS-e e reemissão' })
  pendencias(@CurrentUser() user: AuthUser) {
    return this.cessao.listarPendenciasNfse(user.tenantId ?? 'default');
  }

  @Get('clientes')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('clientes:ler')
  buscarClientes(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('excluirId') excluirId?: string,
  ) {
    return this.cessao.buscarClientes(user.tenantId ?? 'default', q ?? '', excluirId);
  }

  @Get(':unidadeProcessoId')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:ler')
  preview(@Param('unidadeProcessoId') unidadeProcessoId: string, @CurrentUser() user: AuthUser) {
    return this.cessao.preview(unidadeProcessoId, user.tenantId ?? 'default');
  }

  @Post(':unidadeProcessoId/autorizacao-gerente')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:gate')
  autorizar(
    @Param('unidadeProcessoId') unidadeProcessoId: string,
    @Body() body: CessaoAutorizacaoGerenteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cessao.autorizarGerente(
      unidadeProcessoId,
      body.documento,
      body.password,
      user.tenantId,
    );
  }

  @Post(':id/confirmar-reemissao')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('nfse:emitir')
  confirmar(
    @Param('id') id: string,
    @Body() body: ConfirmarReemissaoCessaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cessao.confirmarReemissao(
      id,
      user.id || user.sub,
      user.tenantId ?? 'default',
      body.observacao,
    );
  }

  @Get(':id/comprovante')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:ler')
  @ApiOperation({ summary: 'Baixa o comprovante da cessão (PDF ou imagem)' })
  async comprovante(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const out = await this.cessao.baixarComprovante(id, user.tenantId ?? 'default');
    const safeName = out.filename.replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(out.buffer);
  }

  @Post(':unidadeProcessoId')
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:gate')
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(
    FileInterceptor('comprovante', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  executar(
    @Param('unidadeProcessoId') unidadeProcessoId: string,
    @Body() body: ExecutarCessaoDto,
    @CurrentUser() user: AuthUser,
    @UploadedFile() comprovante?: Express.Multer.File,
  ) {
    return this.cessao.executar(
      unidadeProcessoId,
      body,
      user.id || user.sub,
      user.tenantId ?? 'default',
      comprovante,
    );
  }
}
