/**
 * Governança fiscal — funções puras (conciliação, severidade, scores, sugestões).
 * Somente diagnóstico; não altera dados persistidos.
 */

export type SeveridadeFiscal = 'ALTA' | 'MEDIA' | 'BAIXA';

export interface DivergenciaFiscal {
  codigo: string;
  severidade: SeveridadeFiscal;
  mensagem: string;
  sugestaoCorrecao: string;
  faturamentoId?: string;
  nfsEmitidaId?: string;
  boletoId?: string;
  solicitacaoId?: string;
  valorReferencia?: number;
  valorComparado?: number;
  metadata?: Record<string, unknown>;
}

/** Normaliza status NFS-e municipal (strings livres no modelo atual). */
export function nfsStatusEmitidoOk(statusIpm: string): boolean {
  const u = (statusIpm || '').toUpperCase();
  return u === 'ACEITO';
}

export function nfsStatusCancelado(statusIpm: string): boolean {
  const u = (statusIpm || '').toUpperCase();
  return u.includes('CANCEL');
}

/** Pendente retorno / retry / rejeição tratável como risco municipal. */
export function nfsStatusPendenteMunicipio(statusIpm: string): boolean {
  const u = (statusIpm || '').toUpperCase();
  if (nfsStatusEmitidoOk(statusIpm) || nfsStatusCancelado(statusIpm)) return false;
  return ['PENDENTE', 'ENVIADO', 'REJEITADO', 'PENDENTE_CANCEL'].some((x) => u.includes(x)) || u === '';
}

export function nfsSemRetornoPrefeitura(statusIpm: string): boolean {
  const u = (statusIpm || '').toUpperCase();
  return u === 'PENDENTE' || u === 'ENVIADO' || u === 'REJEITADO';
}

/** Tenta extrair valor monetário do XML da NFS-e (IPM / genérico). */
export function extrairValorMonetarioXmlNfse(xml: string): number | null {
  if (!xml || xml.length < 20) return null;
  const patterns: RegExp[] = [
    /<ValorLiquidoNfse[^>]*>\s*([\d.,]+)\s*</i,
    /<valorLiquidoNfse[^>]*>\s*([\d.,]+)\s*</i,
    /<ValorTotal[^>]*>\s*([\d.,]+)\s*</i,
    /<valorTotal[^>]*>\s*([\d.,]+)\s*</i,
    /<ValorServicos[^>]*>\s*([\d.,]+)\s*</i,
  ];
  for (const re of patterns) {
    const m = xml.match(re);
    if (m?.[1]) {
      const raw = m[1].replace(/\./g, '').replace(',', '.');
      const n = parseFloat(raw);
      if (Number.isFinite(n) && n >= 0) return Math.round(n * 100) / 100;
    }
  }
  return null;
}

export interface FatLinhaInput {
  id: string;
  valorTotal: number;
  itensValorSoma: number;
  nfsEmitidas: Array<{ id: string; numeroNfe: string; statusIpm: string; xmlNfe: string; updatedAt: Date }>;
  boletos: Array<{ id: string; valorBoleto: number; statusPagamento: string }>;
  solicitacoesCount: number;
  itensDescricaoVazia: boolean;
  itensValorZero: boolean;
}

export function construirDivergenciasFaturamento(linhas: FatLinhaInput[]): DivergenciaFiscal[] {
  const out: DivergenciaFiscal[] = [];

  for (const fat of linhas) {
    const nfsOk = fat.nfsEmitidas.filter((n) => nfsStatusEmitidoOk(n.statusIpm));

    const diffItens = Math.abs(fat.valorTotal - fat.itensValorSoma);
    if (diffItens > 0.02) {
      out.push({
        codigo: 'FAT_VALOR_DIFERE_SOMA_ITENS',
        severidade: 'ALTA',
        mensagem: `Faturamento ${fat.id}: valorTotal diverge da soma dos itens.`,
        sugestaoCorrecao: 'Revisar lançamento de itens ou valor total no faturamento.',
        faturamentoId: fat.id,
        valorReferencia: fat.valorTotal,
        valorComparado: fat.itensValorSoma,
      });
    }

    if (fat.valorTotal > 0 && nfsOk.length === 0) {
      out.push({
        codigo: 'FAT_SEM_NFSE_EMITIDA',
        severidade: 'ALTA',
        mensagem: `Faturamento ${fat.id}: valor faturado sem NFS-e aceita pelo município.`,
        sugestaoCorrecao: 'Emitir NFS-e ou corrigir status municipal (homologação ACEITO).',
        faturamentoId: fat.id,
      });
    }

    if (nfsOk.length > 1) {
      out.push({
        codigo: 'NFSE_MULTIPLAS_ATIVAS',
        severidade: 'ALTA',
        mensagem: `Faturamento ${fat.id}: mais de uma NFS-e em situação aceita.`,
        sugestaoCorrecao: 'Manter apenas uma nota válida; cancelar duplicidade conforme legislação.',
        faturamentoId: fat.id,
      });
    }

    if (nfsOk.length > 0 && fat.boletos.length === 0) {
      out.push({
        codigo: 'NFSE_SEM_BOLETO',
        severidade: 'MEDIA',
        mensagem: `Faturamento ${fat.id}: NFS-e aceita sem boleto vinculado.`,
        sugestaoCorrecao: 'Gerar boleto correspondente ao valor do faturamento.',
        faturamentoId: fat.id,
        nfsEmitidaId: nfsOk[0]?.id,
      });
    }

    if (fat.boletos.length > 0 && nfsOk.length === 0) {
      out.push({
        codigo: 'BOLETO_SEM_NFSE_ATIVA',
        severidade: 'MEDIA',
        mensagem: `Faturamento ${fat.id}: boleto registrado sem NFS-e ativa.`,
        sugestaoCorrecao: 'Emitir NFS-e ou cancelar boleto indevido.',
        faturamentoId: fat.id,
        boletoId: fat.boletos[0]?.id,
      });
    }

    if (fat.solicitacoesCount === 0 && fat.valorTotal > 0) {
      out.push({
        codigo: 'FAT_SEM_SOLICITACOES',
        severidade: 'MEDIA',
        mensagem: `Faturamento ${fat.id}: sem solicitações vinculadas.`,
        sugestaoCorrecao: 'Vincular solicitações ao faturamento ou documentar exceção contratual.',
        faturamentoId: fat.id,
      });
    }

    if (fat.itensDescricaoVazia || fat.itensValorZero) {
      out.push({
        codigo: 'ITEM_FAT_INCONSISTENTE',
        severidade: 'BAIXA',
        mensagem: `Faturamento ${fat.id}: item com descrição vazia ou valor zero.`,
        sugestaoCorrecao: 'Revisar catálogo de serviços / descrições dos itens.',
        faturamentoId: fat.id,
      });
    }

    for (const nfs of nfsOk) {
      const vXml = extrairValorMonetarioXmlNfse(nfs.xmlNfe);
      if (vXml !== null && Math.abs(vXml - fat.valorTotal) > 0.05) {
        out.push({
          codigo: 'VALOR_NFSE_DIFERE_FATURAMENTO',
          severidade: 'ALTA',
          mensagem: `NFS-e ${nfs.numeroNfe}: valor XML difere do faturamento.`,
          sugestaoCorrecao: 'Conciliar valores ou emitir nota retificadora.',
          faturamentoId: fat.id,
          nfsEmitidaId: nfs.id,
          valorReferencia: fat.valorTotal,
          valorComparado: vXml,
        });
      }
    }
  }

  return out;
}

export function divergenciasNotasDuplicadasPorNumero(
  nfsList: Array<{ id: string; numeroNfe: string; faturamentoId: string }>,
): DivergenciaFiscal[] {
  const porNumero = new Map<string, typeof nfsList>();
  for (const n of nfsList) {
    const k = (n.numeroNfe || '').trim();
    if (!k) continue;
    if (!porNumero.has(k)) porNumero.set(k, []);
    porNumero.get(k)!.push(n);
  }
  const out: DivergenciaFiscal[] = [];
  for (const [numero, grupos] of porNumero) {
    if (grupos.length > 1) {
      out.push({
        codigo: 'NFSE_NUMERO_DUPLICADO',
        severidade: 'ALTA',
        mensagem: `Número de NFS-e duplicado na base: ${numero}.`,
        sugestaoCorrecao: 'Investigar registros duplicados e manter unicidade por número.',
        metadata: { ids: grupos.map((g) => g.id), faturamentoIds: [...new Set(grupos.map((g) => g.faturamentoId))] },
      });
    }
  }
  return out;
}

export function scoreRiscoFiscalPct(divergencias: { severidade: SeveridadeFiscal }[]): number {
  let pts = 0;
  for (const d of divergencias) {
    if (d.severidade === 'ALTA') pts += 18;
    else if (d.severidade === 'MEDIA') pts += 10;
    else pts += 4;
  }
  return Math.min(100, Math.round(pts * 10) / 10);
}

export function scoreRiscoOperacionalPct(params: {
  eventosCriticos: number;
  fluxosAnomalos: number;
  segurancaEventos: number;
}): number {
  const pts =
    params.eventosCriticos * 14 +
    params.fluxosAnomalos * 11 +
    Math.min(40, params.segurancaEventos * 3);
  return Math.min(100, Math.round(pts * 10) / 10);
}

export function indiceConfiabilidadeFiscalPct(riscoFiscalPct: number, riscoOpPct: number): number {
  const raw = 100 - (riscoFiscalPct * 0.55 + riscoOpPct * 0.45);
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
}

export interface SugestaoSaneamento {
  codigoDivergencia: string;
  acaoSugerida: string;
  prioridade: SeveridadeFiscal;
}

export function saneamentoSugeridoDeDivergencias(
  divs: Array<Pick<DivergenciaFiscal, 'codigo' | 'severidade' | 'sugestaoCorrecao'>>,
): SugestaoSaneamento[] {
  return divs.map((d) => ({
    codigoDivergencia: d.codigo,
    acaoSugerida: d.sugestaoCorrecao,
    prioridade: d.severidade,
  }));
}
