import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AcaoAuditoria } from '@prisma/client';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { SolicitacoesV2Service } from '../modules/solicitacoes-v2/solicitacoes-v2.service';
import { CreateSolicitacaoV2Dto } from '../modules/solicitacoes-v2/dto/create-solicitacao-v2.dto';
import { CxPortalSegment } from './decorators/cx-portal.decorators';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from './guards/cx-portal-auth.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalSegmentGuard } from './guards/cx-portal-segment.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import type { CxPortalRequestUser } from './types/cx-portal.types';
import { PessoaPermissoesGuard } from '../common/guards/pessoa-permissoes.guard';
import { PessoaPode } from '../common/decorators/pessoa-pode.decorator';

/**
 * `POST /portal/v2/solicitacoes` e anexos com JWT **portal** (Bearer IAM cliente).
 * Staff intranet usa {@link SolicitacoesV2Controller} em `/v2/solicitacoes`.
 */
@ApiTags('solicitacoes-v2-portal')
@ApiBearerAuth('access-token')
@Controller('portal/v2/solicitacoes')
@UseGuards(CxPortalPublicApiForbidGuard, CxPortalAuthGuard, CxPortalRateLimitGuard, CxPortalSegmentGuard, PessoaPermissoesGuard)
@CxPortalSegment('cliente')
@UseInterceptors(PortalCxInterceptor)
export class PortalSolicitacoesV2Controller {
  constructor(
    private readonly solicitacoesV2: SolicitacoesV2Service,
    private readonly auditoria: AuditoriaService,
  ) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = req.cxUser;
    if (!u) throw new NotFoundException();
    return u;
  }

  private async audPortal(
    u: CxPortalRequestUser,
    rota: string,
    extra?: Record<string, unknown>,
    acao: AcaoAuditoria = AcaoAuditoria.READ,
  ) {
    try {
      await this.auditoria.registrar({
        tabela: 'cx_portal',
        registroId: u.sub,
        acao,
        usuario: u.sub,
        dadosDepois: { portal: true, tipo: 'PORTAL', rota, portalPapel: u.portalPapel, ...extra },
      });
    } catch {
      /* não bloquear CX */
    }
  }

  @Post('com-anexos')
  @PessoaPode('criarSolicitacao', 'anexarDocumentos')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Criar solicitação v2 com anexos (multipart)',
    description:
      'Campos: `payload` (string JSON alinhada a CreateSolicitacaoV2Dto) e `files` (JPG/PDF, até 5MB cada).',
  })
  @UseInterceptors(
    FilesInterceptor('files', 12, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async criarComAnexos(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Body('payload') payloadRaw: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const u = this.cx(req);
    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadRaw || '{}');
    } catch {
      throw new BadRequestException('Campo payload deve ser JSON válido');
    }
    const dto = plainToInstance(CreateSolicitacaoV2Dto, parsed);
    const errs = validateSync(dto, { whitelist: true, forbidUnknownValues: false });
    if (errs.length) {
      const msgs = errs.flatMap((e) => (e.constraints ? Object.values(e.constraints) : []));
      throw new BadRequestException(msgs.join('; ') || 'Validação do payload falhou');
    }
    if (!files?.length) {
      throw new BadRequestException('Envie ao menos um arquivo (campo files)');
    }
    await this.audPortal(u, 'POST /portal/v2/solicitacoes/com-anexos', undefined, AcaoAuditoria.INSERT);
    return this.solicitacoesV2.criarPortal(dto, u, req, { anexos: files });
  }

  @Post()
  @PessoaPode('criarSolicitacao')
  @ApiOperation({
    summary: 'Criar solicitação v2 (portal cliente)',
    description: 'Anexos: POST /portal/v2/solicitacoes/:id/anexos (multipart, campo file).',
  })
  @ApiBody({ type: CreateSolicitacaoV2Dto })
  async criar(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Body() body: CreateSolicitacaoV2Dto) {
    const u = this.cx(req);
    await this.audPortal(u, 'POST /portal/v2/solicitacoes', undefined, AcaoAuditoria.INSERT);
    return this.solicitacoesV2.criarPortal(body, u, req);
  }

  @Post(':id/anexos')
  @PessoaPode('anexarDocumentos')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Anexar JPG/PDF (máx. 5MB)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async anexar(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const u = this.cx(req);
    await this.audPortal(u, `POST /portal/v2/solicitacoes/${id}/anexos`, undefined, AcaoAuditoria.INSERT);
    return this.solicitacoesV2.anexarPortal(id, u, file);
  }
}
