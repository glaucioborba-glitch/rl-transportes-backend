import { toMoneyNumber } from '../conta-corrente/conta-corrente.util';

export type PortalFatOrigem = 'FATURAMENTO' | 'GATE_OUT';

export type PortalFatItem = {
  id: string;
  descricao: string;
  valor: number;
};

export type PortalFatNfse = {
  id: string;
  numeroNfe: string;
  statusIpm: string;
  createdAt: string;
  linkNfsePdf: string | null;
};

export type PortalFatBoleto = {
  id: string;
  numeroBoleto: string;
  valorBoleto: number;
  dataVencimento: string;
  statusPagamento: string;
  linkPdf: string | null;
};

export type PortalFatLinhaArmazenagem = {
  id: string;
  valorTotal: number;
  statusPagamento: string;
  dataEmissao: string;
  linkNfse: string | null;
  linkBoleto: string | null;
  linkPix: string | null;
  containerIso: string | null;
  diasCobrados: number | null;
};

export type PortalFatEnvelope = {
  id: string;
  origem: PortalFatOrigem;
  numeroFat: string;
  periodo: string;
  referencia: string;
  valorTotal: number;
  statusNfe: string;
  statusBoleto: string;
  statusPagamento: string | null;
  createdAt: string;
  itens: PortalFatItem[];
  nfsEmitidas: PortalFatNfse[];
  boletos: PortalFatBoleto[];
  solicitacoesVinculadas: { solicitacao?: { id: string; protocolo: string | null } }[];
  faturasArmazenagem: PortalFatLinhaArmazenagem[];
  linkNfse: string | null;
  linkBoleto: string | null;
  linkPix: string | null;
};

export function numeroFat(createdAt: Date, id: string): string {
  const y = createdAt.getUTCFullYear();
  const m = String(createdAt.getUTCMonth() + 1).padStart(2, '0');
  const tail = id.replace(/-/g, '').slice(-6).toUpperCase();
  return `FAT-${y}${m}-${tail}`;
}

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : String(d);
}

function periodoYm(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function mapLinhaArmazenagem(row: {
  id: string;
  valorTotal: unknown;
  statusPagamento: string;
  dataEmissao: Date;
  linkNfse: string | null;
  linkBoleto: string | null;
  linkPix: string | null;
  preFatura?: { containerIso?: string | null; diasCobrados?: number | null } | null;
}): PortalFatLinhaArmazenagem {
  return {
    id: row.id,
    valorTotal: toMoneyNumber(row.valorTotal),
    statusPagamento: row.statusPagamento,
    dataEmissao: iso(row.dataEmissao),
    linkNfse: row.linkNfse,
    linkBoleto: row.linkBoleto,
    linkPix: row.linkPix,
    containerIso: row.preFatura?.containerIso ?? null,
    diasCobrados: row.preFatura?.diasCobrados ?? null,
  };
}

export function mapFaturamentoToFat(row: {
  id: string;
  periodo: string;
  valorTotal: unknown;
  statusNfe: string;
  statusBoleto: string;
  createdAt: Date;
  itens?: { id: string; descricao: string; valor: unknown }[];
  nfsEmitidas?: {
    id: string;
    numeroNfe: string;
    statusIpm: string;
    createdAt: Date;
    linkNfsePdf?: string | null;
  }[];
  boletos?: {
    id: string;
    numeroBoleto: string;
    valorBoleto: unknown;
    dataVencimento: Date;
    statusPagamento: string;
    linkPdf?: string | null;
  }[];
  solicitacoesVinculadas?: { solicitacao?: { id: string; protocolo: string | null } | null }[];
  faturasArmazenagem?: {
    id: string;
    valorTotal: unknown;
    statusPagamento: string;
    dataEmissao: Date;
    linkNfse: string | null;
    linkBoleto: string | null;
    linkPix: string | null;
    preFatura?: { containerIso?: string | null; diasCobrados?: number | null } | null;
  }[];
}): PortalFatEnvelope {
  const linhas = (row.faturasArmazenagem ?? []).map(mapLinhaArmazenagem);
  const itens: PortalFatItem[] = [
    ...(row.itens ?? []).map((i) => ({
      id: i.id,
      descricao: i.descricao,
      valor: toMoneyNumber(i.valor),
    })),
    ...linhas.map((l) => ({
      id: `arm-${l.id}`,
      descricao: l.containerIso
        ? `ID operacional ${l.containerIso}${l.diasCobrados != null ? ` · ${l.diasCobrados} diária(s)` : ''}`
        : 'ID operacional (pátio)',
      valor: l.valorTotal,
    })),
  ];
  return {
    id: row.id,
    origem: 'FATURAMENTO',
    numeroFat: numeroFat(row.createdAt, row.id),
    periodo: row.periodo,
    referencia: row.periodo,
    valorTotal: toMoneyNumber(row.valorTotal),
    statusNfe: row.statusNfe,
    statusBoleto: row.statusBoleto,
    statusPagamento: null,
    createdAt: iso(row.createdAt),
    itens,
    nfsEmitidas: (row.nfsEmitidas ?? []).map((n) => ({
      id: n.id,
      numeroNfe: n.numeroNfe,
      statusIpm: n.statusIpm,
      createdAt: iso(n.createdAt),
      linkNfsePdf: n.linkNfsePdf ?? null,
    })),
    boletos: (row.boletos ?? []).map((b) => ({
      id: b.id,
      numeroBoleto: b.numeroBoleto,
      valorBoleto: toMoneyNumber(b.valorBoleto),
      dataVencimento: iso(b.dataVencimento),
      statusPagamento: b.statusPagamento,
      linkPdf: b.linkPdf ?? null,
    })),
    solicitacoesVinculadas: (row.solicitacoesVinculadas ?? []).map((s) => ({
      solicitacao: s.solicitacao ? { id: s.solicitacao.id, protocolo: s.solicitacao.protocolo } : undefined,
    })),
    faturasArmazenagem: linhas,
    linkNfse: linhas.find((l) => l.linkNfse)?.linkNfse ?? null,
    linkBoleto: linhas.find((l) => l.linkBoleto)?.linkBoleto ?? null,
    linkPix: null,
  };
}

export function mapGateOutToFat(row: {
  id: string;
  valorTotal: unknown;
  dataEmissao: Date;
  createdAt?: Date;
  statusPagamento: string;
  linkNfse: string | null;
  linkBoleto: string | null;
  linkPix: string | null;
  preFatura?: { containerIso?: string | null; diasCobrados?: number | null } | null;
}): PortalFatEnvelope {
  const when = row.createdAt ?? row.dataEmissao;
  const linha = mapLinhaArmazenagem(row);
  const isoCx = linha.containerIso;
  const ref = isoCx ? `Pátio · ${isoCx}` : periodoYm(row.dataEmissao);
  return {
    id: row.id,
    origem: 'GATE_OUT',
    numeroFat: numeroFat(when, row.id),
    periodo: periodoYm(row.dataEmissao),
    referencia: ref,
    valorTotal: linha.valorTotal,
    statusNfe: linha.linkNfse ? 'emitida' : row.statusPagamento,
    statusBoleto: linha.linkBoleto ? 'emitido' : row.statusPagamento,
    statusPagamento: row.statusPagamento,
    createdAt: iso(when),
    itens: [
      {
        id: row.id,
        descricao: isoCx
          ? `ID operacional ${isoCx}${linha.diasCobrados != null ? ` · ${linha.diasCobrados} diária(s)` : ''}`
          : 'ID operacional (pátio)',
        valor: linha.valorTotal,
      },
    ],
    nfsEmitidas: [],
    boletos: [],
    solicitacoesVinculadas: [],
    faturasArmazenagem: [linha],
    linkNfse: linha.linkNfse,
    linkBoleto: linha.linkBoleto,
    linkPix: linha.linkPix,
  };
}

export function unificarFats(
  mensais: Parameters<typeof mapFaturamentoToFat>[0][],
  avulsas: Parameters<typeof mapGateOutToFat>[0][],
): PortalFatEnvelope[] {
  const linked = new Set(
    mensais.flatMap((m) => (m.faturasArmazenagem ?? []).map((f) => f.id)),
  );
  const fats = [
    ...mensais.map(mapFaturamentoToFat),
    ...avulsas.filter((a) => !linked.has(a.id)).map(mapGateOutToFat),
  ];
  fats.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return fats;
}
