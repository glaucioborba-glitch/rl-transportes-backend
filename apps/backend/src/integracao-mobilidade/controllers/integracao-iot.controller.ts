import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IotSensorDto } from '../dto/iot-sensor.dto';
import { IntegracaoInternoGuard } from '../guards/integracao-interno.guard';
import { IntegracaoIpAllowlistGuard } from '../guards/integracao-ip-allowlist.guard';
import { IotSensorStore } from '../stores/iot-sensor.store';

@ApiTags('integracao-iot')
@Controller('integracao/iot')
@UseGuards(IntegracaoIpAllowlistGuard, IntegracaoInternoGuard)
export class IntegracaoIotController {
  constructor(private readonly store: IotSensorStore) {}

  @Post('sensor')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Telemetria IoT (somente armazenamento em memoria nesta fase)',
    description:
      'Requer X-Integracao-Interno. Sensores: ocupacao de patio, temperatura, vigilancia.',
  })
  sensor(@Body() dto: IotSensorDto) {
    return this.store.add({
      tipo: dto.tipo,
      valor: dto.valor,
      raw: dto.raw,
    });
  }
}
