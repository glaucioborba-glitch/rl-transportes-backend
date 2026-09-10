import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ActiveTenantsService } from './active-tenants.service';
import { EmpresaOperadoraService } from './empresa-operadora.service';

@Injectable()
export class EmpresaEncargosCronService {
  private readonly logger = new Logger(EmpresaEncargosCronService.name);

  constructor(
    private readonly tenants: ActiveTenantsService,
    private readonly empresa: EmpresaOperadoraService,
  ) {}

  /** 00:01 do dia 1 — fecha a provisão do mês que acabou (America/Sao_Paulo). */
  @Cron('1 0 1 * *', { timeZone: 'America/Sao_Paulo' })
  async handleMonthlyProvision() {
    this.logger.log('CRON provisão de encargos — competência do mês anterior');
    const ids = await this.tenants.listActiveTenantIds();
    let gravadas = 0;
    let puladas = 0;
    for (const tenantId of ids) {
      try {
        const out = await this.empresa.gerarProvisaoAutomaticaMesAnterior(tenantId);
        if (out.skipped) {
          puladas += 1;
          this.logger.log(`Tenant ${tenantId}: ${out.competencia} já gravada — skip`);
        } else {
          gravadas += 1;
          this.logger.log(
            `Tenant ${tenantId}: provisão ${out.competencia} = R$ ${out.total} (${out.qtdFaturas} faturas)`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Tenant ${tenantId}: falha na provisão automática — ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    this.logger.log(`CRON encargos concluído — ${gravadas} gravada(s), ${puladas} já existia(m)`);
  }
}
