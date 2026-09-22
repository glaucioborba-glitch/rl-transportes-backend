import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PessoaPode } from '../common/decorators/pessoa-pode.decorator';
import { PessoaPermissoesGuard } from '../common/guards/pessoa-permissoes.guard';
import { CxPortalSegment } from './decorators/cx-portal.decorators';
import { SimularValoresPortalDto } from './dto/portal-simulacao-valores.dto';
import { CxPortalAuthGuard, CxPortalPublicApiForbidGuard } from './guards/cx-portal-auth.guard';
import { CxPortalRateLimitGuard } from './guards/cx-portal-rate-limit.guard';
import { CxPortalSegmentGuard } from './guards/cx-portal-segment.guard';
import { PortalCxInterceptor } from './interceptors/portal-cx.interceptor';
import { PortalSimulacaoValoresService } from './services/portal-simulacao-valores.service';
import type { CxPortalRequestUser } from './types/cx-portal.types';

@ApiTags('cx-portal-simulacao-valores')
@ApiBearerAuth('access-token')
@Controller('cliente/portal/simulacao-valores')
@UseGuards(
  CxPortalPublicApiForbidGuard,
  CxPortalAuthGuard,
  CxPortalRateLimitGuard,
  CxPortalSegmentGuard,
  PessoaPermissoesGuard,
)
@CxPortalSegment('cliente')
@UseInterceptors(PortalCxInterceptor)
export class PortalSimulacaoValoresController {
  constructor(private readonly simulacao: PortalSimulacaoValoresService) {}

  private cx(req: Request & { cxUser?: CxPortalRequestUser }) {
    const u = req.cxUser;
    if (!u) throw new NotFoundException();
    return u;
  }

  @Get()
  @PessoaPode('verOS')
  @ApiOperation({ summary: 'Unidades no pátio com valor já lançado na pré-fatura' })
  catalogo(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Query('clienteId') clienteId?: string,
  ) {
    return this.simulacao.catalogo(this.cx(req), clienteId);
  }

  @Post()
  @PessoaPode('verOS')
  @ApiOperation({ summary: 'Prevê o valor das unidades na data de saída, a partir da pré-fatura' })
  simular(
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
    @Body() dto: SimularValoresPortalDto,
    @Query('clienteId') clienteId?: string,
  ) {
    return this.simulacao.simular(this.cx(req), dto, clienteId);
  }
}
