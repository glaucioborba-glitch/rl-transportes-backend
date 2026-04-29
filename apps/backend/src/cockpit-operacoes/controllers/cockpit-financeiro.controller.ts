import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CockpitAccessGuard } from '../guards/cockpit-access.guard';
import { CockpitFinanceiroService } from '../services/cockpit-financeiro.service';

@ApiTags('cockpit-financeiro')
@ApiBearerAuth('access-token')
@Controller('cockpit/financeiro')
@UseGuards(AuthGuard('jwt'), CockpitAccessGuard)
export class CockpitFinanceiroController {
  constructor(private readonly fin: CockpitFinanceiroService) {}

  @Get('riscos')
  @ApiOperation({ summary: 'Riscos fiscais e financeiros read-only' })
  riscos() {
    return this.fin.riscos();
  }

  @Get('eventos')
  @ApiOperation({ summary: 'Eventos NF/boleto recentes' })
  eventos() {
    return this.fin.eventos();
  }
}
