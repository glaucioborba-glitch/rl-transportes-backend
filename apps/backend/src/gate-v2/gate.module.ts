import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfOperacionalV2Module } from '../pdf-operacional-v2/pdf-operacional-v2.module';
import { SecurityEventsModule } from '../security-center/security-events.module';
import { SolicitacoesV2Module } from '../modules/solicitacoes-v2/solicitacoes-v2.module';
import { PatioV2Module } from '../patio-v2/patio.module';
import { PatioV2Service } from '../patio-v2/patio.service';
import { ArmazenagemFaturamentoModule } from '../armazenagem-faturamento/armazenagem-faturamento.module';
import { YardAllocationModule } from '../yard-allocation/yard-allocation.module';
import { GateV2Controller } from './gate.controller';
import { GateQrController } from './gate-qr.controller';
import { GateOperacaoFlowController } from './gate-operacao-flow.controller';
import { GateOperacaoFlowService } from './gate-operacao-flow.service';
import { GateV2Service } from './gate.service';
import { VistoriaModule } from '../vistoria/vistoria.module';
import { VistoriaGateController } from '../vistoria/vistoria-gate.controller';
import { HoldReleaseModule } from '../hold-release/hold-release.module';
import { OCRModule } from '../modules/ocr/ocr.module';

@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    PdfOperacionalV2Module,
    SecurityEventsModule,
    SolicitacoesV2Module,
    PatioV2Module,
    ArmazenagemFaturamentoModule,
    YardAllocationModule,
    VistoriaModule,
    HoldReleaseModule,
    OCRModule,
  ],
  controllers: [GateV2Controller, GateQrController, VistoriaGateController, GateOperacaoFlowController],
  providers: [GateV2Service, GateOperacaoFlowService],
  exports: [GateV2Service, GateOperacaoFlowService],
})
export class GateV2Module {}
