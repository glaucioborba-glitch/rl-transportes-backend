import { randomUUID } from 'crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import type { PlataformaTenant, PlataformaTenantConfig } from '../plataforma.types';

const defaultConfig: PlataformaTenantConfig = {
  slasHorasProxy: { gate: 4, patio: 72, saida: 24 },
  horarioFuncionamento: '06:00–22:00 UTC',
  regrasOperacao: 'Padrão corporativo (simulado Fase 18).',
};

@Injectable()
export class PlataformaTenantStore implements OnModuleInit {
  private readonly tenants = new Map<string, PlataformaTenant>();

  onModuleInit() {
    if (!this.tenants.has('default')) {
      this.tenants.set('default', {
        id: 'default',
        nome: 'Terminal corporativo (default)',
        clienteIds: [],
        config: { ...defaultConfig, regrasOperacao: 'Tenant default — sem segregação de clientes até configurar.' },
        createdAt: new Date().toISOString(),
      });
    }
  }

  listar(): PlataformaTenant[] {
    return [...this.tenants.values()];
  }

  obter(id: string): PlataformaTenant | undefined {
    return this.tenants.get(id);
  }

  criar(nome: string, clienteIds: string[], config?: Partial<PlataformaTenantConfig>): PlataformaTenant {
    const id = randomUUID();
    const t: PlataformaTenant = {
      id,
      nome,
      clienteIds: [...new Set(clienteIds)],
      config: { ...defaultConfig, ...config },
      createdAt: new Date().toISOString(),
    };
    this.tenants.set(id, t);
    return t;
  }
}
