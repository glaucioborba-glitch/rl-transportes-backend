import { Module } from '@nestjs/common';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { AuditoriaModule } from '../../auditoria/auditoria.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AgendamentosModule } from '../../agendamentos/agendamentos.module';
import { RedisModule } from '../../redis/redis.module';
import { SecurityEventsModule } from '../../security-center/security-events.module';
import { SolicitacoesV2Service } from './solicitacoes-v2.service';
import { SolicitacaoAnexoStorageService } from './solicitacao-anexo.storage';
import { SolicitacoesV2Controller } from './solicitacoes-v2.controller';
import { YardAllocationModule } from '../../yard-allocation/yard-allocation.module';
import { HoldReleaseModule } from '../../hold-release/hold-release.module';

@Module({
  imports: [PrismaModule, AuditoriaModule, AuditLogModule, AgendamentosModule, RedisModule, SecurityEventsModule, YardAllocationModule, HoldReleaseModule],
  controllers: [SolicitacoesV2Controller],
  providers: [SolicitacoesV2Service, SolicitacaoAnexoStorageService],
  exports: [SolicitacoesV2Service, SolicitacaoAnexoStorageService],
})
export class SolicitacoesV2Module {}
