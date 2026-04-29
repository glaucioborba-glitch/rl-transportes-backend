import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';

export type PortalTicket = {
  id: string;
  tenantId: string;
  autorSub: string;
  portalPapel: string;
  assunto: string;
  corpo: string;
  categoria: 'operacional' | 'financeiro' | 'outro';
  status: 'aberto' | 'em_atendimento' | 'fechado';
  criadoEm: string;
  respostas: { autorSub: string; texto: string; criadoEm: string }[];
};

@Injectable()
export class PortalTicketsStore {
  private readonly tickets: PortalTicket[] = [];

  criar(t: Omit<PortalTicket, 'id' | 'criadoEm' | 'respostas' | 'status'> & { status?: PortalTicket['status'] }) {
    const x: PortalTicket = {
      id: randomUUID(),
      criadoEm: new Date().toISOString(),
      respostas: [],
      status: t.status ?? 'aberto',
      ...t,
    };
    this.tickets.push(x);
    return x;
  }

  listar(filtro: { tenantId?: string; autorSub?: string }) {
    return this.tickets
      .filter((x) => (filtro.tenantId ? x.tenantId === filtro.tenantId : true))
      .filter((x) => (filtro.autorSub ? x.autorSub === filtro.autorSub : true))
      .slice(-500)
      .reverse();
  }

  obter(id: string) {
    return this.tickets.find((x) => x.id === id);
  }

  responder(id: string, autorSub: string, texto: string) {
    const t = this.obter(id);
    if (!t) return undefined;
    t.respostas.push({ autorSub, texto, criadoEm: new Date().toISOString() });
    if (t.status === 'aberto') t.status = 'em_atendimento';
    return t;
  }
}
