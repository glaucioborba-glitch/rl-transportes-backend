import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CockpitAccessGuard } from '../guards/cockpit-access.guard';
import { CockpitTimelineService } from '../services/cockpit-timeline.service';

@ApiTags('cockpit-timeline')
@ApiBearerAuth('access-token')
@Controller('cockpit/timeline')
@UseGuards(AuthGuard('jwt'), CockpitAccessGuard)
export class CockpitTimelineController {
  constructor(private readonly timeline: CockpitTimelineService) {}

  @Get('fluxo')
  @ApiOperation({ summary: 'Linha do tempo portaria → gate → pátio → saída + SLA proxy' })
  fluxo(@Query('limite') limite?: string) {
    return this.timeline.fluxo(limite ? parseInt(limite, 10) || 80 : 80);
  }

  @Get('eventos')
  @ApiOperation({ summary: 'Eventos críticos (auditoria + proxies operacionais)' })
  eventos(@Query('limite') limite?: string) {
    return this.timeline.eventos(limite ? parseInt(limite, 10) || 120 : 120);
  }
}
