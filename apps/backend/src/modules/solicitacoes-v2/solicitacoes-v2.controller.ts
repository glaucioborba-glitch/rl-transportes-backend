import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ListSolicitacoesV2QueryDto } from './dto/list-solicitacoes-v2.dto';
import { StaffRejeitarV2Dto } from './dto/staff-rejeitar-v2.dto';
import { StaffSolicitacaoV2DetalheEnvelopeDto } from './dto/staff-solicitacao-v2-detalhe.dto';
import { CreateBloqueioDto } from '../../hold-release/dto/create-bloqueio.dto';
import { SolicitacoesV2Service } from './solicitacoes-v2.service';

/**
 * API v2 staff (JWT intranet) — rotas estáticas antes de `:id`.
 * Criação no portal: {@link PortalSolicitacoesV2Controller}.
 */
@ApiTags('solicitacoes-v2')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('v2/solicitacoes')
export class SolicitacoesV2Controller {
  constructor(private readonly service: SolicitacoesV2Service) {}

  @Get('metricas/resumo')
  @ApiOperation({ summary: 'Métricas operacionais (30d) — volumetria, LS/Rodotrem, CHEIO/VAZIO, reefer' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
  @Permissions('solicitacoes:ler')
  metricasResumo() {
    return this.service.obterMetricasResumoStaff();
  }

  @Get()
  @ApiOperation({ summary: 'Listar solicitações corporativas (com transporte v2)' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
  @Permissions('solicitacoes:ler')
  listar(@Query() query: ListSolicitacoesV2QueryDto) {
    return this.service.listarStaff(query);
  }

  @Delete('anexos/:anexoId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover anexo (DELETE /v2/solicitacoes/anexos/:id)' })
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('solicitacoes:excluir')
  removerAnexo(@Param('anexoId') anexoId: string, @CurrentUser() user: AuthUser) {
    return this.service.removerAnexoStaff(anexoId, user);
  }

  @Post(':id/anexos')
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Anexar JPG/PDF (staff)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('solicitacoes:atualizar')
  anexar(@Param('id') id: string, @CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return this.service.anexarStaff(id, user, file);
  }

  @Get(':id/historico-alteracoes')
  @ApiOperation({ summary: 'Histórico imutável de alterações críticas (visão global staff)' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
  @Permissions('solicitacoes:ler')
  historicoAlteracoes(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.historicoAlteracoesStaff(id, user);
  }

  @Post(':id/bloqueios')
  @ApiOperation({ summary: 'Aplicar bloqueio operacional (Hold Engine)' })
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('solicitacoes:atualizar')
  aplicarBloqueio(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: CreateBloqueioDto) {
    return this.service.aplicarBloqueioStaff(id, user, body);
  }

  @Post(':id/bloqueios/:bloqueioId/liberar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liberar bloqueio (Release)' })
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('solicitacoes:atualizar')
  liberarBloqueio(
    @Param('id') id: string,
    @Param('bloqueioId') bloqueioId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.liberarBloqueioStaff(id, bloqueioId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe (transporte, containers, anexos, auditoria, alertas)' })
  @ApiOkResponse({ type: StaffSolicitacaoV2DetalheEnvelopeDto })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE, Role.OPERADOR_PATIO)
  @Permissions('solicitacoes:ler')
  async detalhe(@Param('id') id: string) {
    const r = await this.service.obterDetalheStaff(id);
    if (!r) throw new NotFoundException('Solicitação v2 não encontrada');
    return r;
  }

  @Post(':id/aprovar')
  @ApiOperation({ summary: 'Aprovar (exige anexos registrados)' })
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('solicitacoes:atualizar')
  aprovar(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.aprovarStaff(id, user);
  }

  @Post(':id/rejeitar')
  @ApiOperation({ summary: 'Rejeitar' })
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('solicitacoes:atualizar')
  rejeitar(@Param('id') id: string, @CurrentUser() user: AuthUser, @Body() body: StaffRejeitarV2Dto) {
    return this.service.rejeitarStaff(id, user, body.motivo);
  }
}
