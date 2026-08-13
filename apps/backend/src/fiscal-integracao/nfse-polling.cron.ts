import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StatusPagamentoFatura } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FEATURE_FLAG_KEYS } from '../feature-flags/feature-flag.keys';
import { FeatureFlagService } from '../feature-flags/feature-flag.service';
import { FiscalIpmService } from './fiscal-ipm.service';

/** Polling de NFS-e pendentes (RPS enviado, nota ainda processando na prefeitura). */
@Injectable()
export class NfsePollingCronService {
  private readonly logger = new Logger(NfsePollingCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscal: FiscalIpmService,
    private readonly flags: FeatureFlagService,
  ) {}

  @Cron('*/5 * * * *')
  async pollPendingNfse() {
    if (!(await this.flags.isEnabled(FEATURE_FLAG_KEYS.FISCAL_INTEGRATION_ENABLED))) {
      return;
    }

    const pendentes = await this.prisma.nfsEmitida.findMany({
      where: { statusIpm: { in: ['PENDENTE', 'PROCESSANDO'] }, referenciaExterna: { not: null } },
      take: 40,
      orderBy: { updatedAt: 'asc' },
    });
    if (!pendentes.length) return;

    for (const nfs of pendentes) {
      const cod = nfs.referenciaExterna?.trim();
      if (!cod) continue;
      try {
        const hit = await this.fiscal.consultarPendente(cod);
        if (!hit) continue;

        await this.prisma.$transaction(async (tx) => {
          await tx.nfsEmitida.update({
            where: { id: nfs.id },
            data: {
              numeroNfe: hit.numeroNfse,
              statusIpm: 'ACEITO',
              linkNfsePdf: hit.linkNfse || undefined,
              xmlNfe: hit.xmlResposta,
            },
          });

          const faturas = await tx.fatura.findMany({
            where: { faturamentoId: nfs.faturamentoId, statusPagamento: StatusPagamentoFatura.PROCESSANDO },
          });
          for (const f of faturas) {
            const boletoOk = !!f.linkBoleto;
            await tx.fatura.update({
              where: { id: f.id },
              data: {
                linkNfse: hit.linkNfse || f.linkNfse,
                statusPagamento: boletoOk ? StatusPagamentoFatura.AGUARDANDO_PAGAMENTO : StatusPagamentoFatura.PROCESSANDO,
                processamentoErro: null,
              },
            });
          }

          await tx.faturamento.update({
            where: { id: nfs.faturamentoId },
            data: { statusNfe: 'emitida' },
          });
        });

        this.logger.log(`NFS-e ${nfs.id} autorizada via polling (${hit.numeroNfse})`);
      } catch (e) {
        this.logger.warn(`Polling NFS-e ${nfs.id}: ${(e as Error).message}`);
      }
    }
  }
}
