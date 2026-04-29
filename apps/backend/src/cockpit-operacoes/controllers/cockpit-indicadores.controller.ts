import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CockpitAccessGuard } from '../guards/cockpit-access.guard';
import { CockpitIndicadoresService } from '../services/cockpit-indicadores.service';

@ApiTags('cockpit-indicadores')
@ApiBearerAuth('access-token')
@Controller('cockpit/indicadores')
@UseGuards(AuthGuard('jwt'), CockpitAccessGuard)
export class CockpitIndicadoresController {
  constructor(private readonly ind: CockpitIndicadoresService) {}

  @Get()
  @ApiOperation({ summary: 'KPIs throughput, SLA, ocupação, UPH mobile proxy' })
  resumo() {
    return this.ind.resumo();
  }

  @Get('turno')
  @ApiOperation({ summary: 'Indicadores agregados ao turno (proxy diário)' })
  turno() {
    return this.ind.turno();
  }
}
