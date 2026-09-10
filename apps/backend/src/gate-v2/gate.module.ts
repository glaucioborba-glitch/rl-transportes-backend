import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfOperacionalV2Module } from '../pdf-operacional-v2/pdf-operacional-v2.module';
import { SecurityEventsModule } from '../security-center/security-events.module';
import { SolicitacoesV2Module } from '../modules/solicitacoes-v2/solicitacoes-v2.module';
import { PatioV2Module } from '../patio-v2/patio.module';
import { YardAllocationModule } from '../yard-allocation/yard-allocation.module';
import { CadastrosModule } from '../cadastros/cadastros.module';
import { GateV2Controller } from './gate.controller';
import { GateQrController } from './gate-qr.controller';
import { GateOperacaoFlowController } from './gate-operacao-flow.controller';
import { GateOperacaoFlowService } from './gate-operacao-flow.service';
import { GateV2Service } from './gate.service';
import { PrevisaoNaviosService } from './previsao-navios/previsao-navios.service';
import { VistoriaModule } from '../vistoria/vistoria.module';
import { VistoriaGateController } from '../vistoria/vistoria-gate.controller';
import { HoldReleaseModule } from '../hold-release/hold-release.module';
import { OCRModule } from '../modules/ocr/ocr.module';
import { UnidadeProcessoModule } from '../unidade-processo/unidade-processo.module';
import { AuthModule } from '../auth/auth.module';
import { CessaoTitularidadeModule } from '../cessao-titularidade/cessao-titularidade.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    PdfOperacionalV2Module,
    SecurityEventsModule,
    SolicitacoesV2Module,
    PatioV2Module,
    YardAllocationModule,
    VistoriaModule,
    HoldReleaseModule,
    OCRModule,
    CadastrosModule,
    UnidadeProcessoModule,
    AuthModule,
    CessaoTitularidadeModule,
    TenantModule,
  ],
  controllers: [GateV2Controller, GateQrController, VistoriaGateController, GateOperacaoFlowController],
  providers: [GateV2Service, GateOperacaoFlowService, PrevisaoNaviosService],
  exports: [GateV2Service, GateOperacaoFlowService, PrevisaoNaviosService],
})
export class GateV2Module {}
