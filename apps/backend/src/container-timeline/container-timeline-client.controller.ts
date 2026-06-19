import { Controller, ForbiddenException, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CxPortalSegment } from '../cx-portais/decorators/cx-portal.decorators';
import {
  CxPortalAuthGuard,
  CxPortalPublicApiForbidGuard,
} from '../cx-portais/guards/cx-portal-auth.guard';
import { CxPortalRateLimitGuard } from '../cx-portais/guards/cx-portal-rate-limit.guard';
import { CxPortalSegmentGuard } from '../cx-portais/guards/cx-portal-segment.guard';
import { PessoaPermissoesGuard } from '../common/guards/pessoa-permissoes.guard';
import type { CxPortalRequestUser } from '../cx-portais/types/cx-portal.types';
import { ContainerTimelineService } from './container-timeline.service';
import { Iso6346ParamPipe } from './iso6346-param.pipe';

@ApiTags('Container Timeline (Portal Cliente)')
@ApiBearerAuth()
@Controller('client/container')
@UseGuards(
  CxPortalPublicApiForbidGuard,
  CxPortalAuthGuard,
  CxPortalRateLimitGuard,
  CxPortalSegmentGuard,
  PessoaPermissoesGuard,
)
@CxPortalSegment('cliente')
export class ContainerTimelineClientController {
  constructor(private readonly timeline: ContainerTimelineService) {}

  @Get(':iso/timeline')
  @ApiOperation({
    summary: 'Linha do tempo simplificada do contêiner (portal cliente — tenant isolation)',
  })
  clientTimeline(
    @Param('iso', Iso6346ParamPipe) iso: string,
    @Req() req: Request & { cxUser?: CxPortalRequestUser },
  ) {
    const u = req.cxUser;
    if (!u || u.portalPapel !== 'CLIENTE' || !u.clienteId) {
      throw new ForbiddenException('Acesso restrito ao portal cliente.');
    }
    return this.timeline.getClientTimeline(iso, u.clienteId);
  }
}
