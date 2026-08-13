import type {
  GateContainerSituacao,
  GateDespachoItem,
  GateFilaChegadaItem,
  GateOperacaoAtivaItem,
} from "./gate-cockpit-types";

export type YardFlowColumnId = "chegada" | "liberado" | "em_operacao" | "pronto_saida";

export type YardFlowCard = {
  id: string;
  column: YardFlowColumnId;
  container: string;
  tipoTamanho: string | null;
  situacao: GateContainerSituacao | null;
  placa: string | null;
  motorista: string | null;
  empresa: string;
  referenciaEm: string;
  empilhadeira: string | null;
  operadorEmpilhadeira: string | null;
  slotBaia: string | null;
  operacaoTipo: "BAIXA" | "COLETA" | null;
  pdfGerado: boolean;
  chegadaTimestamp: string | null;
};

export type YardFlowColumns = Record<YardFlowColumnId, YardFlowCard[]>;

function containerHero(isos: string[]): string {
  return isos[0]?.trim() || "—";
}

function inferOperacaoTipo(situacao: GateContainerSituacao | null): "BAIXA" | "COLETA" | null {
  if (situacao === "CHEIO") return "BAIXA";
  if (situacao === "VAZIO") return "COLETA";
  return null;
}

function isEmOperacao(item: GateOperacaoAtivaItem): boolean {
  return !!(item.empilhadeiraAtribuida || item.osStatus === "EM_EXECUCAO");
}

function isLiberado(item: GateOperacaoAtivaItem): boolean {
  return item.osStatus === "APROVADA" && !item.empilhadeiraAtribuida;
}

function mapFilaToCard(item: GateFilaChegadaItem): YardFlowCard {
  return {
    id: `fila-${item.id}`,
    column: "chegada",
    container: containerHero(item.containersIso),
    tipoTamanho: item.tipoTamanho ?? item.tipoContainer,
    situacao: item.situacao ?? null,
    placa: item.placa,
    motorista: item.motorista,
    empresa: item.cliente.razaoSocial,
    referenciaEm: item.chegadaEm,
    empilhadeira: null,
    operadorEmpilhadeira: null,
    slotBaia: null,
    operacaoTipo: null,
    pdfGerado: false,
    chegadaTimestamp: item.chegadaEm,
  };
}

function mapOperacaoToCard(item: GateOperacaoAtivaItem, column: YardFlowColumnId): YardFlowCard {
  const referenciaEm =
    column === "liberado" && item.liberadoEm
      ? item.liberadoEm
      : (item.entradaEm ?? new Date().toISOString());
  return {
    id: `operacao-${item.id}`,
    column,
    container: containerHero(item.containersIso),
    tipoTamanho: item.tipoTamanho ?? null,
    situacao: item.situacao ?? null,
    placa: item.placa,
    motorista: item.motorista ?? null,
    empresa: item.cliente.razaoSocial,
    referenciaEm,
    empilhadeira: item.empilhadeiraAtribuida,
    operadorEmpilhadeira: item.operador,
    slotBaia: item.slotBaia ?? null,
    operacaoTipo: column === "em_operacao" ? inferOperacaoTipo(item.situacao ?? null) : null,
    pdfGerado: false,
    chegadaTimestamp: item.entradaEm ?? null,
  };
}

function mapDespachoToCard(item: GateDespachoItem): YardFlowCard {
  return {
    id: `despacho-${item.id}`,
    column: "pronto_saida",
    container: containerHero(item.containersIso),
    tipoTamanho: item.tipoTamanho ?? null,
    situacao: item.situacao ?? null,
    placa: item.placa,
    motorista: item.motorista,
    empresa: item.cliente.razaoSocial,
    referenciaEm: item.prontoDesde,
    empilhadeira: null,
    operadorEmpilhadeira: null,
    slotBaia: null,
    operacaoTipo: null,
    pdfGerado: item.statusDb === "AGUARDANDO_GATE_OUT",
    chegadaTimestamp: null,
  };
}

export function buildYardFlowColumns(
  fila: GateFilaChegadaItem[],
  operacao: GateOperacaoAtivaItem[],
  despacho: GateDespachoItem[],
): YardFlowColumns {
  const chegada: YardFlowCard[] = fila.map(mapFilaToCard);
  const liberado: YardFlowCard[] = [];
  const emOperacao: YardFlowCard[] = [];

  for (const item of operacao) {
    if (isEmOperacao(item)) {
      emOperacao.push(mapOperacaoToCard(item, "em_operacao"));
    } else if (isLiberado(item)) {
      liberado.push(mapOperacaoToCard(item, "liberado"));
    } else {
      chegada.push(mapOperacaoToCard(item, "chegada"));
    }
  }

  const prontoSaida = despacho.map(mapDespachoToCard);

  return {
    chegada,
    liberado,
    em_operacao: emOperacao,
    pronto_saida: prontoSaida,
  };
}

export function formatElapsedLabel(desde: string, suffix: string): string {
  const ms = Math.max(0, Date.now() - new Date(desde).getTime());
  const min = Math.floor(ms / 60_000);
  if (min < 1) return `< 1 min ${suffix}`;
  if (min < 60) return `${min} min ${suffix}`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h}h ${rest}min ${suffix}` : `${h}h ${suffix}`;
}

export function formatHoraChegada(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
