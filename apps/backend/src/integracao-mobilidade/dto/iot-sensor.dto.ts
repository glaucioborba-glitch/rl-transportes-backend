import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsObject } from 'class-validator';
import type { IotTipoSensor } from '../stores/iot-sensor.store';

export class IotSensorDto {
  @ApiProperty({ enum: ['ocupacaoPatio', 'temperaturaContainer', 'vigilanciaMovimento'] })
  @IsIn(['ocupacaoPatio', 'temperaturaContainer', 'vigilanciaMovimento'])
  tipo!: IotTipoSensor;

  @ApiProperty()
  @IsNumber()
  valor!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  raw?: Record<string, unknown>;
}
