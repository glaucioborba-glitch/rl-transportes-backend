import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SimuladorTerminalController } from './simulador-terminal.controller';
import { SimuladorTerminalService } from './simulador-terminal.service';

@Module({
  imports: [PrismaModule],
  controllers: [SimuladorTerminalController],
  providers: [SimuladorTerminalService],
  exports: [SimuladorTerminalService],
})
export class SimuladorTerminalModule {}
