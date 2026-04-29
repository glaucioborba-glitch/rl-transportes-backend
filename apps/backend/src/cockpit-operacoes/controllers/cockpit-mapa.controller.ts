import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CockpitAccessGuard } from '../guards/cockpit-access.guard';
import { CockpitMapService } from '../services/cockpit-map.service';

@ApiTags('cockpit-mapa')
@ApiBearerAuth('access-token')
@Controller('cockpit/mapa')
@UseGuards(AuthGuard('jwt'), CockpitAccessGuard)
export class CockpitMapaController {
  constructor(private readonly map: CockpitMapService) {}

  @Get('patio')
  @ApiOperation({ summary: 'Mapa lógico do pátio (ocupação, heatmap, mobile)' })
  patio() {
    return this.map.patio();
  }

  @Get('gate')
  @ApiOperation({ summary: 'Situação gate-in/out e trilhas mobile' })
  gate() {
    return this.map.gate();
  }

  @Get('portaria')
  @ApiOperation({ summary: 'Portaria + fila proxy + eventos mobile' })
  portaria() {
    return this.map.portaria();
  }

  @Get('veiculos')
  @ApiOperation({ summary: 'Veículos em ciclo operacional e estágio atual' })
  veiculos() {
    return this.map.veiculos();
  }
}
