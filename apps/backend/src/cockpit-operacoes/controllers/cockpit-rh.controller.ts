import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CockpitAccessGuard } from '../guards/cockpit-access.guard';
import { CockpitRHService } from '../services/cockpit-rh.service';

@ApiTags('cockpit-rh')
@ApiBearerAuth('access-token')
@Controller('cockpit/rh')
@UseGuards(AuthGuard('jwt'), CockpitAccessGuard)
export class CockpitRHController {
  constructor(private readonly rh: CockpitRHService) {}

  @Get('turno')
  @ApiOperation({ summary: 'Headcount e presença proxy por turno' })
  turno() {
    return this.rh.turno();
  }

  @Get('eficiencia')
  @ApiOperation({ summary: 'Eficiência operacional RH + gargalos proxy' })
  eficiencia() {
    return this.rh.eficiencia();
  }
}
