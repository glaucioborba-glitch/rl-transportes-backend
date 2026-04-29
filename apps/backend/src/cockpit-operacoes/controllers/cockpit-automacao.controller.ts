import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CockpitAccessGuard } from '../guards/cockpit-access.guard';
import { CockpitAutomacaoService } from '../services/cockpit-automacao.service';

@ApiTags('cockpit-automacao')
@ApiBearerAuth('access-token')
@Controller('cockpit/automacao')
@UseGuards(AuthGuard('jwt'), CockpitAccessGuard)
export class CockpitAutomacaoController {
  constructor(private readonly auto: CockpitAutomacaoService) {}

  @Get()
  @ApiOperation({ summary: 'Painel workflows/RPA/schedulers (Fase 19, read-only)' })
  painel() {
    return this.auto.painel();
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Jobs RPA recentes' })
  jobs() {
    return this.auto.jobs();
  }
}
