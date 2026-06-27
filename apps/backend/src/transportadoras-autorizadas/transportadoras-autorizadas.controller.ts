import {
  Body,
  Controller,
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
import { PessoaPermissoesGuard } from '../common/guards/pessoa-permissoes.guard';
import { PessoaPode } from '../common/decorators/pessoa-pode.decorator';
import { isPortalPrincipalTenant } from '../common/constants/portal-tenant-roles.util';
import { CreateTransportadoraAutorizadaDto } from './dto/create-transportadora.dto';
import { TransportadorasAutorizadasService } from './transportadoras-autorizadas.service';

@ApiTags('transportadoras-autorizadas')
@ApiBearerAuth('access-token')
@UseGuards(CxPortalPublicApiForbidGuard, CxPortalAuthGuard, PessoaPermissoesGuard)
@Controller('cliente/transportadoras-autorizadas')
export class TransportadorasAutorizadasController {
  constructor(private readonly service: TransportadorasAutorizadasService) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }): CxPortalRequestUser {
    const u = req.cxUser;
    if (!u) throw new ForbiddenException('Contexto portal ausente');
    if (!isPortalPrincipalTenant(u)) {
      throw new ForbiddenException('Transportadoras não podem gerenciar delegações.');
    }
    return u;
  }

  @Get(':clienteId')
  @ApiOperation({ summary: 'Listar transportadoras autorizadas pelo tenant principal' })
  listar(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('clienteId') clienteId: string,
  ) {
    return this.service.listar(this.cx(req), clienteId);
  }

  @Post()
  @PessoaPode('gerenciarPessoas')
  @ApiOperation({ summary: 'Autorizar transportadora terceirizada (login CNPJ + permissões fixas)' })
  criar(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Body() dto: CreateTransportadoraAutorizadaDto,
  ) {
    return this.service.criar(this.cx(req), dto);
  }

  @Patch(':id/ativo')
  @PessoaPode('gerenciarPessoas')
  @ApiOperation({ summary: 'Ativar/desativar transportadora autorizada' })
  alternarAtivo(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Param('id') id: string,
    @Body() body: { ativo: boolean },
  ) {
    return this.service.alternarAtivo(this.cx(req), id, body.ativo !== false);
  }
}
