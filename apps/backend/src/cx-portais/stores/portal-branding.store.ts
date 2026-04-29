import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';

export type PortalBrandingConfig = {
  id: string;
  tenantId: string;
  cores: { primaria: string; secundaria: string };
  logoUrl?: string;
  tema: 'light' | 'dark';
  menuItens: string[];
  slasExibidos: string[];
  kpisExibidos: string[];
  atualizadoEm: string;
};

@Injectable()
export class PortalBrandingStore {
  private readonly byTenant = new Map<string, PortalBrandingConfig>();

  obter(tenantId: string): PortalBrandingConfig {
    return (
      this.byTenant.get(tenantId) ?? {
        id: 'default',
        tenantId,
        cores: { primaria: '#0d6efd', secundaria: '#6c757d' },
        tema: 'light',
        menuItens: ['dashboard', 'solicitacoes', 'financeiro', 'slas', 'kpis', 'chamados'],
        slasExibidos: ['gate', 'patio', 'saida'],
        kpisExibidos: ['ciclo_medio_horas', 'containers_ativos', 'faturamento_aberto'],
        atualizadoEm: new Date().toISOString(),
      }
    );
  }

  salvar(tenantId: string, patch: Partial<Omit<PortalBrandingConfig, 'id' | 'tenantId' | 'atualizadoEm'>>): PortalBrandingConfig {
    const prev = this.obter(tenantId);
    const next: PortalBrandingConfig = {
      ...prev,
      ...patch,
      id: prev.id === 'default' ? randomUUID() : prev.id,
      tenantId,
    };
    next.atualizadoEm = new Date().toISOString();
    this.byTenant.set(tenantId, next);
    return next;
  }
}
