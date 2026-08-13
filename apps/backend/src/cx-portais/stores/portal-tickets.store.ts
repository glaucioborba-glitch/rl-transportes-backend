import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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

type Resposta = { autorSub: string; texto: string; criadoEm: string };

@Injectable()
export class PortalTicketsStore {
  constructor(private readonly prisma: PrismaService) {}

  private mapRow(row: {
    id: string;
    tenantId: string;
    autorSub: string;
    portalPapel: string;
    assunto: string;
    corpo: string;
    categoria: string;
    status: string;
    respostas: unknown;
    createdAt: Date;
  }): PortalTicket {
    return {
      id: row.id,
      tenantId: row.tenantId,
      autorSub: row.autorSub,
      portalPapel: row.portalPapel,
      assunto: row.assunto,
      corpo: row.corpo,
      categoria: row.categoria as PortalTicket['categoria'],
      status: row.status as PortalTicket['status'],
      criadoEm: row.createdAt.toISOString(),
      respostas: (row.respostas as Resposta[]) ?? [],
    };
  }

  async criar(
    t: Omit<PortalTicket, 'id' | 'criadoEm' | 'respostas' | 'status'> & { status?: PortalTicket['status'] },
  ) {
    const row = await this.prisma.cxPortalTicket.create({
      data: {
        tenantId: t.tenantId,
        autorSub: t.autorSub,
        portalPapel: t.portalPapel,
        assunto: t.assunto,
        corpo: t.corpo,
        categoria: t.categoria,
        status: t.status ?? 'aberto',
        respostas: [],
      },
    });
    return this.mapRow(row);
  }

  async listar(filtro: { tenantId?: string; autorSub?: string }) {
    const rows = await this.prisma.cxPortalTicket.findMany({
      where: {
        ...(filtro.tenantId ? { tenantId: filtro.tenantId } : {}),
        ...(filtro.autorSub ? { autorSub: filtro.autorSub } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows.map((r) => this.mapRow(r));
  }

  async obter(id: string) {
    const row = await this.prisma.cxPortalTicket.findUnique({ where: { id } });
    return row ? this.mapRow(row) : undefined;
  }

  async responder(id: string, autorSub: string, texto: string) {
    const t = await this.obter(id);
    if (!t) return undefined;
    const respostas: Resposta[] = [...t.respostas, { autorSub, texto, criadoEm: new Date().toISOString() }];
    const status = t.status === 'aberto' ? 'em_atendimento' : t.status;
    const row = await this.prisma.cxPortalTicket.update({
      where: { id },
      data: { respostas, status },
    });
    return this.mapRow(row);
  }
}
