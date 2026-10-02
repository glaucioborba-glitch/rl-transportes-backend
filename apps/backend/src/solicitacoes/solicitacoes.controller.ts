import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SolicitacaoPaginationDto } from '../common/dtos/pagination.dto';
import { Iso6346ValidationPipe, MercosulPlateValidationPipe } from '../common/pipes';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AddUnidadeSolicitacaoDto } from './dto/add-unidade-solicitacao.dto';
import { CreateGateDto } from './dto/create-gate.dto';
import { CreatePatioDto } from './dto/create-patio.dto';
import { CreatePortariaDto } from './dto/create-portaria.dto';
import { CreateSaidaDto } from './dto/create-saida.dto';
import { CreateSolicitacaoDto } from './dto/create-solicitacao.dto';
import { UpdateSolicitacaoDto } from './dto/update-solicitacao.dto';
import { SolicitacoesService } from './solicitacoes.service';

@ApiTags('solicitacoes-v1-deprecated')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
@Controller('solicitacoes')
export class SolicitacoesController {
  constructor(private readonly solicitacoesService: SolicitacoesService) {}

  @Get()
  @ApiOperation({
    deprecated: true,
    summary: 'Listar solicitações (v1 — use GET /v2/solicitacoes)',
  })
  @Roles(
    Role.ADMIN,
    Role.GERENTE,
    Role.OPERADOR_PORTARIA,
    Role.OPERADOR_GATE,
    Role.OPERADOR_PATIO,
    Role.CLIENTE,
  )
  @Permissions('solicitacoes:ler')
  findAll(@Query() query: SolicitacaoPaginationDto, @CurrentUser() user: AuthUser) {
    return this.solicitacoesService.findAllPaginated(
      query,
      {
        clienteId: query.clienteId,
        status: query.status,
      },
      user,
    );
  }

  @Get('export/csv')
  @ApiOperation({ deprecated: true, summary: 'Export CSV (v1 — use v2)' })
  @Roles(
    Role.ADMIN,
    Role.GERENTE,
    Role.OPERADOR_PORTARIA,
    Role.OPERADOR_GATE,
    Role.OPERADOR_PATIO,
  )
  @Permissions('solicitacoes:ler')
  async exportCsv(
    @Res({ passthrough: false }) res: Response,
    @Query() query: SolicitacaoPaginationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const csv = await this.solicitacoesService.buildExportCsv(query, user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="solicitacoes.csv"');
    res.send(`\uFEFF${csv}`);
  }

  @Get(':id')
  @ApiOperation({ deprecated: true, summary: 'Obter solicitação (v1 — use GET /v2/solicitacoes/:id)' })
  @Roles(
    Role.ADMIN,
    Role.GERENTE,
    Role.OPERADOR_PORTARIA,
    Role.OPERADOR_GATE,
    Role.OPERADOR_PATIO,
    Role.CLIENTE,
  )
  @Permissions('solicitacoes:ler')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.solicitacoesService.findOne(id, user);
  }

  @Post()
  @ApiOperation({ deprecated: true, summary: 'Criar solicitação (v1 — use POST /v2/solicitacoes)' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA)
  @Permissions('solicitacoes:criar')
  create(@Body() dto: CreateSolicitacaoDto, @CurrentUser() user: AuthUser) {
    return this.solicitacoesService.create(dto, user.id);
  }

  @Post('unidades')
  @ApiOperation({ deprecated: true, summary: 'Adicionar unidade (v1)' })
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('solicitacoes:criar')
  addContainer(
    @Body(Iso6346ValidationPipe) dto: AddUnidadeSolicitacaoDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.solicitacoesService.addContainer(dto, user.id);
  }

  @Post('portaria')
  @ApiOperation({ deprecated: true, summary: 'Portaria (v1 — use gate v2)' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA)
  @Permissions('solicitacoes:portaria')
  registerPortaria(
    @Body(MercosulPlateValidationPipe) dto: CreatePortariaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.solicitacoesService.registerPortaria(dto, user.id);
  }

  @Post('gate')
  @ApiOperation({ deprecated: true, summary: 'Gate (v1 — use /v2/gate)' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:gate')
  registerGate(@Body() dto: CreateGateDto, @CurrentUser() user: AuthUser) {
    return this.solicitacoesService.registerGate(dto, user.id);
  }

  @Post('patio')
  @ApiOperation({ deprecated: true, summary: 'Pátio (v1 — use /v2/patio)' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PATIO)
  @Permissions('solicitacoes:patio')
  registerPatio(@Body() dto: CreatePatioDto, @CurrentUser() user: AuthUser) {
    return this.solicitacoesService.registerPatio(dto, user.id);
  }

  @Post('saida')
  @ApiOperation({ deprecated: true, summary: 'Saída (v1 — use /v2/gate)' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:saida')
  registerSaida(@Body() dto: CreateSaidaDto, @CurrentUser() user: AuthUser) {
    return this.solicitacoesService.registerSaida(dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ deprecated: true, summary: 'Atualizar (v1 — use PATCH /v2/solicitacoes/:id)' })
  @Roles(Role.ADMIN, Role.GERENTE, Role.OPERADOR_PORTARIA, Role.OPERADOR_GATE)
  @Permissions('solicitacoes:atualizar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSolicitacaoDto,
    @CurrentUser() user: AuthUser,
    @Request() req: { ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = (req as { ip?: string }).ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.solicitacoesService.update(id, dto, user.id, user, ip, userAgent);
  }

  @Delete(':id')
  @ApiOperation({ deprecated: true, summary: 'Excluir (v1)' })
  @Roles(Role.ADMIN, Role.GERENTE)
  @Permissions('solicitacoes:excluir')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Request() req: { ip?: string; get: (h: string) => string | undefined },
  ) {
    const ip = (req as { ip?: string }).ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    return this.solicitacoesService.remove(id, user.id, ip, userAgent);
  }
}
