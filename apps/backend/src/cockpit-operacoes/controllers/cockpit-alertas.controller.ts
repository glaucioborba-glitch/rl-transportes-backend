import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CockpitAccessGuard } from '../guards/cockpit-access.guard';
import { CockpitAlertasService } from '../services/cockpit-alertas.service';

@ApiTags('cockpit-alertas')
@ApiBearerAuth('access-token')
@Controller('cockpit/alertas')
@UseGuards(AuthGuard('jwt'), CockpitAccessGuard)
export class CockpitAlertasController {
  constructor(private readonly alertas: CockpitAlertasService) {}

  @Get()
  @ApiOperation({
    summary: 'NOC Alert Center — IA, GRC proxy, fiscal, financeiro, automação, mobile',
  })
  todos() {
    return this.alertas.todos();
  }

  @Get('criticos')
  @ApiOperation({ summary: 'Alertas críticos e alta severidade' })
  criticos() {
    return this.alertas.criticos();
  }
}
