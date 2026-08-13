import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from '../cx-portais/guards/cx-portal-auth.guard';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import { CreatePessoaAutorizadaDto } from './dto/create-pessoa-autorizada.dto';
import { UpdatePessoaAutorizadaDto } from './dto/update-pessoa-autorizada.dto';
import { PessoasAutorizadasService } from './pessoas-autorizadas.service';
import { PessoaPermissoesGuard } from '../common/guards/pessoa-permissoes.guard';
import { PessoaPode } from '../common/decorators/pessoa-pode.decorator';
import { PessoasPermissoesService } from '../pessoas-permissoes/pessoas-permissoes.service';
import { UpdatePermissoesPessoaDto } from '../pessoas-permissoes/dto/update-permissoes.dto';

@ApiTags('pessoas-autorizadas')
@ApiBearerAuth('access-token')
@UseGuards(CxPortalPublicApiForbidGuard, CxPortalAuthGuard, PessoaPermissoesGuard)
@Controller('cliente/pessoas-autorizadas')
export class PessoasAutorizadasClienteController {
  constructor(
    private readonly service: PessoasAutorizadasService,
    private readonly permissoes: PessoasPermissoesService,
  ) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }): CxPortalRequestUser {
    const u = req.cxUser;
    if (!u) throw new ForbiddenException('Contexto portal ausente');
    return u;
  }

  @Post()
  @PessoaPode('gerenciarPessoas')
  @ApiOperation({ summary: 'Cadastrar pessoa autorizada (cliente logado)' })
  criar(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Body() dto: CreatePessoaAutorizadaDto) {
    return this.service.criar(this.cx(req), dto);
  }

  @Get(':id/permissoes')
  @ApiOperation({ summary: 'Obter permissões RBAC de uma pessoa autorizada' })
  obterPermissoes(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Param('id') id: string) {
    return this.permissoes
      .obterRegistroPorPessoaId(id, this.cx(req))
      .then(({ permissoes }) => permissoes);
  }

  @Post(':id/permissoes')
  @PessoaPode('gerenciarPessoas')
  @ApiOperation({ summary: 'Criar/atualizar permissões (upsert)' })
  upsertPermissoes(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('id') id: string,
    @Body() dto: UpdatePermissoesPessoaDto,
  ) {
    return this.permissoes.upsert(this.cx(req), id, dto);
  }

  @Patch(':id/permissoes')
  @PessoaPode('gerenciarPessoas')
  @ApiOperation({ summary: 'Atualizar permissões parcialmente' })
  patchPermissoes(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('id') id: string,
    @Body() dto: UpdatePermissoesPessoaDto,
  ) {
    return this.permissoes.atualizar(this.cx(req), id, dto);
  }

  @Get(':clienteId')
  @ApiOperation({ summary: 'Listar pessoas autorizadas por clienteId' })
  listar(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Param('clienteId') clienteId: string) {
    return this.service.listarPorCliente(this.cx(req), clienteId);
  }

  @Delete(':id')
  @PessoaPode('gerenciarPessoas')
  @ApiOperation({ summary: 'Remover pessoa autorizada' })
  remover(@Req() req: Request & { cxUser?: CxPortalRequestUser }, @Param('id') id: string) {
    return this.service.remover(this.cx(req), id);
  }

  @Patch(':id')
  @PessoaPode('gerenciarPessoas')
  @ApiOperation({ summary: 'Ativar/desativar pessoa autorizada' })
  atualizar(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('id') id: string,
    @Body() dto: UpdatePessoaAutorizadaDto,
  ) {
    return this.service.atualizar(this.cx(req), id, dto);
  }
}
