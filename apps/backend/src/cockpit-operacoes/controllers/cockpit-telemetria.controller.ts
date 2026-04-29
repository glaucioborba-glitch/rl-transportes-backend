import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CockpitAccessGuard } from '../guards/cockpit-access.guard';
import { CockpitTelemetriaService } from '../services/cockpit-telemetria.service';

@ApiTags('cockpit-telemetria')
@ApiBearerAuth('access-token')
@Controller('cockpit/telemetria')
@UseGuards(AuthGuard('jwt'), CockpitAccessGuard)
export class CockpitTelemetriaController {
  constructor(private readonly tel: CockpitTelemetriaService) {}

  @Get('mobile')
  @ApiOperation({ summary: 'Telemetria mobile agregada (Fase 21)' })
  mobile() {
    return this.tel.mobile();
  }

  @Get('dispositivos')
  @ApiOperation({ summary: 'Dispositivos e métricas agregadas' })
  dispositivos() {
    return this.tel.dispositivos();
  }
}
