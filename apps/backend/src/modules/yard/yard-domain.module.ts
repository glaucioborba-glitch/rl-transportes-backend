import { Module } from '@nestjs/common';
import { ContainerTimelineModule } from '../../container-timeline/container-timeline.module';
import { PatioV2Module } from '../../patio-v2/patio.module';
import { TosModule } from '../../tos/tos.module';
import { YardReadModule } from '../../yard-read/yard-read.module';

/**
 * Bounded Context — Pátio (Yard).
 * Posicionamento, shifting, inventário e snapshot yard-read.
 */
@Module({
  imports: [YardReadModule, PatioV2Module, TosModule, ContainerTimelineModule],
  exports: [YardReadModule, PatioV2Module, TosModule, ContainerTimelineModule],
})
export class YardDomainModule {}
