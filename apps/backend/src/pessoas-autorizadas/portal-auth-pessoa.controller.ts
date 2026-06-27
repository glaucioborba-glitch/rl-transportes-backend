import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
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
import { ValidarPessoaDto } from './dto/validar-pessoa.dto';
import { PessoasAutorizadasService } from './pessoas-autorizadas.service';
@ApiTags('portal-auth-pessoa')
@ApiBearerAuth('access-token')
@UseGuards(CxPortalPublicApiForbidGuard, CxPortalAuthGuard)
@Controller('portal/auth')
export class PortalAuthPessoaController {
  constructor(private readonly service: PessoasAutorizadasService) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }): CxPortalRequestUser {
    const u = req.cxUser;
    if (!u) throw new ForbiddenException('Contexto portal ausente');
    return u;
  }

  @Get('pessoas')
  @ApiOperation({
    summary: 'Descontinuado — use POST /portal/auth/validar-pessoa',
    deprecated: true,
  })
  listarPessoas() {
    throw new ForbiddenException(
      'Listagem de pessoas desabilitada. Valide sua identidade informando seu CPF.',
    );
  }

  @Post('validar-pessoa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma identidade operacional por CPF (validação cega)' })
  validarPessoa(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Body() body: ValidarPessoaDto,
  ) {
    return this.service.validarPessoaPorCpf(this.cx(req), body.cpf, req);
  }

  @Post('escolher-pessoa')
  @ApiOperation({
    summary: 'Descontinuado — use POST /portal/auth/validar-pessoa',
    deprecated: true,
  })
  escolherPessoaDescontinuado() {
    throw new ForbiddenException(
      'Seleção por ID desabilitada. Valide sua identidade informando seu CPF.',
    );
  }

  @Get('pessoa-atual')
  @ApiOperation({ summary: 'Pessoa selecionada na sessão Redis atual' })
  pessoaAtual(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    return this.service.pessoaAtual(this.cx(req));
  }

  @Get('minhas-permissoes')
  @ApiOperation({ summary: 'Permissões RBAC da pessoa selecionada na sessão' })
  minhasPermissoes(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    return this.service.bootstrapMinhasPermissoes(this.cx(req));
  }

  @Get('health')
  @ApiOperation({ summary: 'Healthcheck de sessão portal (pessoa + permissões)' })
  async portalAuthHealth(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    const boot = await this.service.bootstrapMinhasPermissoes(this.cx(req));
    return {
      ...boot,
      ok: true as const,
      timestamp: new Date().toISOString(),
    };
  }
}
