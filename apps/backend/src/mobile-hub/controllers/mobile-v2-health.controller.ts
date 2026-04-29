import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('mobile-hub-v2')
@Controller('mobile/v2')
export class MobileV2HealthController {
  @Get('status')
  @ApiOperation({ summary: 'Contrato v2 (planejado)' })
  status() {
    return { version: 'v2', status: 'planned', message: 'Use /mobile/v1 para produção nesta fase.' };
  }
}
