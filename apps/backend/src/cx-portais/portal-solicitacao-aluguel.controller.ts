import { Body, Controller, Get, NotFoundException, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PessoaPode } from '../common/decorators/pessoa-pode.decorator';
import { PessoaPermissoesGuard } from '../common/guards/pessoa-permissoes.guard';
import { SolicitacaoAluguelService } from '../aluguel/solicitacao-aluguel.service';
import { CriarSolicitacaoAluguelDto } from '../aluguel/dto/solicitacao-aluguel.dto';
import { CxPortalSegment } from './decorators/cx-portal.decorators';
import { CxPortalAuthGuard, CxPortalPublicApiForbidGuard } from './guards/cx-portal-auth.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalSegmentGuard } from './guards/cx-portal-segment.guard';
import { PortalCadastroAprovadoGuard } from './guards/portal-cadastro-aprovado.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import type { CxPortalRequestUser } from './types/cx-portal.types';

@ApiTags('cx-portal-aluguel')
@ApiBearerAuth('access-token')
@Controller('cliente/portal/aluguel')
@UseGuards(
  CxPortalPublicApiForbidGuard,
  CxPortalAuthGuard,
  CxPortalRateLimitGuard,
  CxPortalSegmentGuard,
  PessoaPermissoesGuard,
  PortalCadastroAprovadoGuard,
)
@CxPortalSegment('cliente')
@UseInterceptors(PortalCxInterceptor)
export class PortalSolicitacaoAluguelController {
  constructor(private readonly service: SolicitacaoAluguelService) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = req.cxUser;
    if (!u) throw new NotFoundException();
    return u;
  }

  @Get()
  @PessoaPode('verOS')
  @ApiOperation({ summary: 'Listar pedidos de aluguel do cliente' })
  listar(@Req() req: Request & { cxUser?: CxPortalRequestUser }) {
    return this.service.listarPortal(this.cx(req));
  }

  @Post()
  @PessoaPode('criarSolicitacao')
  @ApiOperation({ summary: 'Solicitar aluguel de uma unidade (fila de Autorizações)' })
  criar(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Body() dto: CriarSolicitacaoAluguelDto,
  ) {
    return this.service.criarPortal(dto, this.cx(req));
  }
}
