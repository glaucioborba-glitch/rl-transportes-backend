import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CockpitAccessGuard } from '../guards/cockpit-access.guard';
import { CockpitExecutivoService } from '../services/cockpit-executivo.service';

@ApiTags('cockpit-executivo')
@ApiBearerAuth('access-token')
@Controller('cockpit/executivo')
@UseGuards(AuthGuard('jwt'), CockpitAccessGuard)
export class CockpitExecutivoController {
  constructor(private readonly exec: CockpitExecutivoService) {}

  @Get()
  @ApiOperation({ summary: 'Dashboard executivo 360° (C-Level)' })
  painel() {
    return this.exec.painel();
  }
}
