import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { CxPortalRequestUser } from '../types/cx-portal.types';

type ContratoCx = { id: string; descricao: string; vigenciaAte: string; status: string };
type PagamentoCx = { id: string; descricao: string; valor: number; vencimento: string; status: string };
type EntregaCx = { id: string; protocolo: string; confirmadoEm: string; fornecedorSub: string };
type DocumentoCx = { id: string; nome: string; tipo: string; recebidoEm: string; fornecedorSub: string };

@Injectable()
export class PortalFornecedorDataService {
  private readonly contratos: ContratoCx[] = [];
  private readonly pagamentos: PagamentoCx[] = [];
  private readonly entregas: EntregaCx[] = [];
  private readonly documentos: DocumentoCx[] = [];

  constructor() {
    this.contratos.push({
      id: randomUUID(),
      descricao: 'Serviço de manutenção predial (simulado)',
      vigenciaAte: '2026-12-31',
      status: 'ativo',
    });
    this.pagamentos.push({
      id: randomUUID(),
      descricao: 'Parcela contrato manutenção',
      valor: 12500,
      vencimento: '2026-05-10',
      status: 'agendado',
    });
  }

  listarContratos(_cx: CxPortalRequestUser) {
    return [...this.contratos];
  }

  listarServicos(_cx: CxPortalRequestUser) {
    return [{ id: 'srv-1', nome: 'Coleta documental', slaDias: 2 }];
  }

  listarPagamentos(_cx: CxPortalRequestUser) {
    return [...this.pagamentos];
  }

  status(cx: CxPortalRequestUser) {
    return {
      fornecedorSub: cx.sub,
      tenantId: cx.tenantId,
      conformidadeGrcProxy: { score: 93, alertasAbertos: 0 },
      contratosAtivos: this.contratos.filter((c) => c.status === 'ativo').length,
      proximoPagamento: this.pagamentos[0] ?? null,
    };
  }

  confirmarEntrega(cx: CxPortalRequestUser, protocolo: string) {
    const e: EntregaCx = {
      id: randomUUID(),
      protocolo,
      confirmadoEm: new Date().toISOString(),
      fornecedorSub: cx.sub,
    };
    this.entregas.push(e);
    return e;
  }

  registrarDocumento(cx: CxPortalRequestUser, meta: { nome: string; tipo: string }) {
    const d: DocumentoCx = {
      id: randomUUID(),
      nome: meta.nome,
      tipo: meta.tipo,
      recebidoEm: new Date().toISOString(),
      fornecedorSub: cx.sub,
    };
    this.documentos.push(d);
    return d;
  }
}
