import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
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
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ContaCorrenteService } from './conta-corrente.service';
import { ContaCorrenteQueryDto } from './dto/conta-corrente-query.dto';
import {
  CompensarContaCorrenteDto,
  CriarLancamentoContaCorrenteDto,
} from './dto/criar-lancamento-conta-corrente.dto';
import { DecidirPixCreditoComprovanteDto } from './dto/decidir-pix-credito-comprovante.dto';

@ApiTags('conta-corrente')
@ApiBearerAuth('access-token')
@Controller('v2/financeiro/conta-corrente')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class ContaCorrenteController {
  constructor(private readonly service: ContaCorrenteService) {}

  @Get()
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:ler')
  @ApiOperation({ summary: 'Listar saldo da conta corrente por cliente' })
  listar(@Query() query: ContaCorrenteQueryDto) {
    return this.service.listar(query);
  }

  @Get('pendencias-count')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:ler')
  @ApiOperation({ summary: 'Comprovantes PIX pendentes de análise na conta corrente' })
  contarPendencias() {
    return this.service.contarPendencias();
  }

  @Get(':clienteId')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:ler')
  obter(@Param('clienteId') clienteId: string) {
    return this.service.obter(clienteId);
  }

  @Get(':clienteId/comprovantes/:id/arquivo')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:ler')
  @ApiOperation({ summary: 'Baixa o comprovante PIX enviado pelo portal' })
  async arquivo(
    @Param('clienteId') clienteId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const out = await this.service.baixarComprovante(clienteId, id);
    const safeName = out.filename.replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(out.buffer);
  }

  @Get(':clienteId/lancamentos/:id/anexo')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:ler')
  @ApiOperation({ summary: 'Baixa o anexo opcional do lançamento' })
  async anexoLancamento(
    @Param('clienteId') clienteId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const out = await this.service.baixarAnexoLancamento(clienteId, id);
    const safeName = out.filename.replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(out.buffer);
  }

  @Post(':clienteId/comprovantes/:id/conferir')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:criar')
  @ApiOperation({ summary: 'Aprova ou nega o comprovante PIX e notifica o cliente' })
  conferir(
    @Param('clienteId') clienteId: string,
    @Param('id') id: string,
    @Body() dto: DecidirPixCreditoComprovanteDto,
    @CurrentUser() user: AuthUser,
    @Request() req: { ip?: string; get: (h: string) => string | undefined },
  ) {
    return this.service.conferirComprovante(
      clienteId,
      id,
      dto,
      user,
      req.ip || 'unknown',
      req.get('user-agent') || 'unknown',
    );
  }

  @Post(':clienteId/lancamentos')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:criar')
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(
    FileInterceptor('anexo', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  lancar(
    @Param('clienteId') clienteId: string,
    @Body() dto: CriarLancamentoContaCorrenteDto,
    @CurrentUser() user: AuthUser,
    @Request() req: { ip?: string; get: (h: string) => string | undefined },
    @UploadedFile() anexo?: Express.Multer.File,
  ) {
    return this.service.lancar(
      clienteId,
      dto,
      user,
      req.ip || 'unknown',
      req.get('user-agent') || 'unknown',
      anexo,
    );
  }

  @Post(':clienteId/compensar')
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('faturamento:criar')
  compensar(
    @Param('clienteId') clienteId: string,
    @Body() dto: CompensarContaCorrenteDto,
    @CurrentUser() user: AuthUser,
    @Request() req: { ip?: string; get: (h: string) => string | undefined },
  ) {
    return this.service.compensar(
      clienteId,
      dto,
      user,
      req.ip || 'unknown',
      req.get('user-agent') || 'unknown',
    );
  }
}
