import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor, FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { GateCheckInDto } from './dto/gate-checkin.dto';
import { GateCheckOutDto } from './dto/gate-checkout.dto';
import { GateRetornarEntradaDto, GateRejeitarOsDto } from './dto/gate-cockpit-action.dto';
import { GateV2Service } from './gate.service';
import { PrevisaoNaviosService } from './previsao-navios/previsao-navios.service';
import { VistoriaService } from '../vistoria/vistoria.service';

const VISTORIA_FOTO_FIELDS = [
  { name: 'foto_FRENTE', maxCount: 1 },
  { name: 'foto_TRASEIRA', maxCount: 1 },
  { name: 'foto_LATERAL_DIREITA', maxCount: 1 },
  { name: 'foto_LATERAL_ESQUERDA', maxCount: 1 },
] as const;

const GATE_ROLES: Role[] = [
  Role.ADMIN,
  Role.GERENTE,
  Role.OPERADOR_PORTARIA,
  Role.OPERADOR_GATE,
  Role.OPERADOR_PATIO,
];

@ApiTags('gate-v2')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('v2/gate')
export class GateV2Controller {
  constructor(
    private readonly gate: GateV2Service,
    private readonly vistoria: VistoriaService,
    private readonly previsaoNavios: PrevisaoNaviosService,
  ) {}

  @Get('metricas/resumo')
  @ApiOperation({ summary: 'Métricas gate (30d): tempos, divergências, LS/Rodotrem' })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  metricasResumo() {
    return this.gate.metricasResumo();
  }

  @Get('previsao-navios')
  @ApiOperation({
    summary:
      'Previsão de chegada de navios (ZP21 Práticos — Itajaí/Navegantes). Cache atualizado a cada ~10 min.',
  })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  previsaoNaviosList(@Query('refresh') refresh?: string) {
    const force = refresh === '1' || refresh === 'true';
    return this.previsaoNavios.getSnapshot(force);
  }

  @Get('cockpit')
  @ApiOperation({ summary: 'Cockpit CPO — fila, operação, pátio, despacho, OS e dashboard' })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  cockpit(@Query('dataRef') dataRef?: string) {
    return this.gate.listarCockpit(dataRef);
  }

  @Post('solicitacoes/:id/direcionar-operacao')
  @ApiOperation({ summary: 'Direcionar caminhão da fila de chegada para operação (empilhadeira)' })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:gate')
  direcionarOperacao(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.gate.direcionarOperacao(id, user.id);
  }

  @Post('solicitacoes/:id/retornar-entrada')
  @ApiOperation({ summary: 'Devolver caminhão — entrada negada no gate' })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:gate')
  retornarEntrada(
    @Param('id') id: string,
    @Body() body: GateRetornarEntradaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.gate.retornarEntrada(id, user.id, body.motivo);
  }

  @Post('check-ins/:gateInId/aprovar-os')
  @ApiOperation({ summary: 'Aprovar ordem de serviço (ADMIN/GERENTE)' })
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('solicitacoes:gate')
  aprovarOs(@Param('gateInId') gateInId: string, @CurrentUser() user: AuthUser) {
    return this.gate.aprovarOs(gateInId, user.id, user.role);
  }

  @Post('check-ins/:gateInId/rejeitar-os')
  @ApiOperation({ summary: 'Rejeitar ordem de serviço com motivo (ADMIN/GERENTE)' })
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('solicitacoes:gate')
  rejeitarOs(
    @Param('gateInId') gateInId: string,
    @Body() body: GateRejeitarOsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.gate.rejeitarOs(gateInId, user.id, user.role, body.motivo);
  }

  @Get('fila')
  @ApiOperation({ summary: 'Fila operacional — aguardando gate / em pátio' })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  fila() {
    return this.gate.listarFilaOperacional();
  }

  @Get('solicitacoes/:id/pre-checkin')
  @ApiOperation({ summary: 'Contexto check-in + autenticidade PDF (hash opcional)' })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  preCheckIn(@Param('id') id: string, @Query('hash') hash?: string) {
    return this.gate.preCheckInContext(id, hash);
  }

  @Post('solicitacoes/:id/check-in')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'JSON stringificado do GateCheckInDto',
        },
        fotos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Legado — preferir foto_FRENTE, foto_TRASEIRA, etc.',
        },
        foto_FRENTE: { type: 'string', format: 'binary' },
        foto_TRASEIRA: { type: 'string', format: 'binary' },
        foto_LATERAL_DIREITA: { type: 'string', format: 'binary' },
        foto_LATERAL_ESQUERDA: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([...VISTORIA_FOTO_FIELDS], {
      storage: memoryStorage(),
      limits: { fileSize: 512 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Registrar check-in (vistoria 4 fotos obrigatórias)' })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:atualizar')
  async checkIn(
    @Param('id') id: string,
    @Req() req: Request,
    @UploadedFiles()
    files: Partial<Record<(typeof VISTORIA_FOTO_FIELDS)[number]['name'], Express.Multer.File[]>>,
    @CurrentUser() user: AuthUser,
  ) {
    const raw = (req.body as { data?: string }).data;
    const dto = plainToInstance(GateCheckInDto, raw ? JSON.parse(raw) : {});
    await validateOrReject(dto);
    const fotosMap = this.vistoria.parseFotosFromMultipart(files ?? {});
    return this.gate.checkIn(id, user.id, dto, fotosMap);
  }

  @Get('check-ins/:gateInId/patio-unidades')
  @ApiOperation({ summary: 'Unidades de pátio criadas após check-in (para posicionamento)' })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:patio')
  patioUnidades(@Param('gateInId') gateInId: string) {
    return this.gate.listPatioUnidadesGateIn(gateInId);
  }

  @Post('check-ins/:gateInId/enviar-patio')
  @ApiOperation({ summary: 'Posicionar unidades do check-in em baias (Gate → Pátio)' })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:patio')
  enviarPatio(
    @Param('gateInId') gateInId: string,
    @Body() body: { posicoes: { unidadeId: string; codigoBaia: string }[] },
    @CurrentUser() user: AuthUser,
  ) {
    return this.gate.enviarGateInParaPatio(gateInId, user.id, body.posicoes ?? []);
  }

  @Get('check-ins/:gateInId/pre-checkout')
  @ApiOperation({ summary: 'Contexto check-out' })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  preCheckOut(@Param('gateInId') gateInId: string) {
    return this.gate.preCheckOutContext(gateInId);
  }

  @Post('check-ins/:gateInId/check-out')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'string', description: 'JSON stringificado do GateCheckOutDto' },
        fotos: { type: 'array', items: { type: 'string', format: 'binary' } },
        foto_FRENTE: { type: 'string', format: 'binary' },
        foto_TRASEIRA: { type: 'string', format: 'binary' },
        foto_LATERAL_DIREITA: { type: 'string', format: 'binary' },
        foto_LATERAL_ESQUERDA: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([...VISTORIA_FOTO_FIELDS], {
      storage: memoryStorage(),
      limits: { fileSize: 512 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Registrar check-out (vistoria 4 fotos obrigatórias)' })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:atualizar')
  async checkOut(
    @Param('gateInId') gateInId: string,
    @Req() req: Request,
    @UploadedFiles()
    files: Partial<Record<(typeof VISTORIA_FOTO_FIELDS)[number]['name'], Express.Multer.File[]>>,
    @CurrentUser() user: AuthUser,
  ) {
    const raw = (req.body as { data?: string }).data;
    const dto = plainToInstance(GateCheckOutDto, raw ? JSON.parse(raw || '{}') : {});
    await validateOrReject(dto);
    const fotosMap = this.vistoria.parseFotosFromMultipart(files ?? {});
    return this.gate.checkOut(gateInId, user.id, dto, fotosMap);
  }

  @Post('ocr/placa-mock')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 4 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'OCR mock de placa / container (sem API externa)' })
  @Roles(...GATE_ROLES)
  @Permissions('solicitacoes:ler')
  async ocrMock(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('Arquivo obrigatório');
    return this.gate.ocrPlacaMockFromBuffer(file.buffer);
  }
}
