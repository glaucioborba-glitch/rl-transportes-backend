import { Module } from '@nestjs/common';
import { EstadoOperacionalController } from './estado-operacional.controller';

@Module({
  controllers: [EstadoOperacionalController],
})
export class EstadoOperacionalModule {}
