import { Injectable } from '@nestjs/common';
import { DEFAULT_TENANT_ID } from '../tenant/tenant.constants';
import { EmpresaOperadoraService } from '../tenant/empresa-operadora.service';
import { generateSaldoPdf } from './patio-saldo-pdf';
import {
  buildSaldoXml,
  filtrarSaldoUnidades,
  type PatioSaldoFiltro,
  type PatioSaldoUnidade,
} from './patio-saldo.util';
import { PatioV2Service } from './patio.service';

@Injectable()
export class PatioSaldoRelatorioService {
  constructor(
    private readonly patio: PatioV2Service,
    private readonly empresa: EmpresaOperadoraService,
  ) {}

  async xml(filtro: PatioSaldoFiltro, tenantId?: string): Promise<string> {
    const { inv, unidades, emp } = await this.carregar(filtro, tenantId);
    return buildSaldoXml({
      geradoEm: inv.geradoEm,
      empresa: {
        nome: emp.nomeFantasia || emp.razaoSocial,
        razaoSocial: emp.razaoSocial,
        cnpj: emp.cnpj,
      },
      lotacaoTotal: inv.lotacaoTotal,
      capacidadeTotal: inv.capacidadeTotal,
      reefers: inv.reefersLigados,
      semBaia: unidades.filter((u) => !u.baia).length,
      filtros: filtro,
      unidades,
    });
  }

  async pdf(filtro: PatioSaldoFiltro, tenantId?: string): Promise<Buffer> {
    const tid = tenantId || DEFAULT_TENANT_ID;
    const [{ inv, unidades, emp }, logoPng] = await Promise.all([
      this.carregar(filtro, tid),
      this.empresa.logoPngBuffer(tid, 'documento'),
    ]);
    return generateSaldoPdf({
      geradoEm: inv.geradoEm,
      empresa: emp,
      logoPng,
      lotacaoTotal: inv.lotacaoTotal,
      capacidadeTotal: inv.capacidadeTotal,
      reefers: inv.reefersLigados,
      semBaia: unidades.filter((u) => !u.baia).length,
      filtros: filtro,
      unidades,
    });
  }

  private async carregar(filtro: PatioSaldoFiltro, tenantId?: string) {
    const inv = await this.patio.inventario();
    const unidades = filtrarSaldoUnidades(inv.unidades as PatioSaldoUnidade[], filtro);
    const emp = await this.empresa.obter(tenantId || DEFAULT_TENANT_ID);
    return { inv, unidades, emp };
  }
}
