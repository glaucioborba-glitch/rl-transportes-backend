import { ApiError, nestErrorMessage, staffJson, staffRequest } from "@/lib/api/staff-client";
import type { OperacaoState } from "./operacao-states";

export type ConferenciaStatus = "CONFERE" | "DIVERGENTE" | "SEM_CAPTURA";
export type ControleColuna = "NA_PORTARIA" | "A_CONFERIR" | "RIC_PENDENTE" | "LIBERADO" | "PRONTO_SAIDA";

export type ContainerOcrExtras = {
  tipoIso?: string;
  tamanhoPes?: string;
  perfil?: string;
  rotulo?: string;
  mgwKg?: string;
  taraKg?: string;
  payloadKg?: string;
  owner?: string;
};

export type OcrIndicativoTipo = {
  tipoIso: string;
  rotulo: string;
  mgwKg?: string;
  taraKg?: string;
  payloadKg?: string;
  owner?: string;
  status: ConferenciaStatus;
  cadastroLabel: string;
  mensagem: string;
};

export type ConferenciaCampo = {
  campo:
    | "container"
    | "placa"
    | "placaCavalo"
    | "placaCarreta"
    | "placaCarreta02"
    | "lacre"
    | "motorista"
    | "cpf";
  label: string;
  solicitado: string;
  capturado: string;
  origemCaptura: "OCR" | "PORTARIA" | "AUSENTE";
  status: ConferenciaStatus;
};

export type OperacaoDto = {
  id: string;
  protocolo: string;
  state: OperacaoState;
  stateLabel: string;
  coluna?: ControleColuna | null;
  gateInId?: string | null;
  containerNumero: string;
  containerTipo: string;
  containerTamanho: string;
  containerSituacao: string;
  containerRefrigerado?: boolean;
  containerSetPoint?: number | null;
  placa: string;
  motoristaNome: string;
  motoristaCpf?: string;
  transportadoraNome: string;
  transportadoraId?: string | null;
  transportadoraCnpj?: string;
  clienteNome: string;
  tipoOperacao: string;
  tipoOperacaoLabel?: string;
  direcaoUnidade?: "ENTRADA" | "SAIDA" | "INTERNA" | null;
  direcaoUnidadeLabel?: string;
  unidadeProcesso?: {
    id: string;
    numero: number;
    label: string;
    status: string;
    entradaEm: string;
    saidaEm: string | null;
  } | null;
  tatInicio: string | null;
  tatFim: string | null;
  vistoria?: {
    fotos: Array<{
      tipo: string;
      imagem: string;
      ocrResult?: string;
      ocrMatch?: boolean;
      ocrConfianca?: number;
      ocrProvider?: string;
      ocrTextoBruto?: string;
      ocrExtras?: ContainerOcrExtras;
    }>;
    avarias: Array<{ foto: string; descricao: string; localizacao: string }>;
  } | null;
  avariasCount?: number;
  fotosCount?: number;
  ricAssinado?: boolean;
  assinaturaPresente?: boolean;
  assinaturaModo?: "DIGITAL" | "MANUAL" | null;
  lacreFotoObrigatoria?: boolean;
  lacreFotoPresente?: boolean;
  caboTomadaFotoObrigatoria?: boolean;
  caboTomadaFotoPresente?: boolean;
  devolucaoPortaria?: {
    motivo: string;
    mensagem: string;
    devolvidaEm: string;
    operadorId?: string;
    fotosRefazer?: string[];
  } | null;
  observacaoGate?: string;
  observacoesEfeito?: string[];
  confirmadosGate?: string[];
  conferencia?: {
    itens: ConferenciaCampo[];
    resumo: { conferem: number; divergentes: number; semCaptura: number };
  };
  ocrIndicativos?: {
    tipo: OcrIndicativoTipo | null;
  };
  lacreTroca?: {
    atual: string;
    anterior: string;
    observacao: string;
    origem: string;
    texto: string;
  } | null;
  dossie?: {
    solicitacao: {
      container: string;
      tipo: string;
      tamanho: string;
      situacao: string;
      lacre?: string;
      booking?: string;
      processo?: string;
      navio?: string;
      refrigerado?: boolean;
      setPoint?: number | null;
      unidadeProcessoNumero?: number | null;
      unidadeProcessoLabel?: string;
      direcaoUnidade?: string;
      direcaoUnidadeLabel?: string;
      placa: string;
      placaCavalo?: string;
      placaCarreta?: string;
      placaCarreta02?: string;
      tipoCaminhao?: string;
      tipoCaminhaoLabel?: string;
      motorista: string;
      cpf: string;
      tipoOperacao: string;
      cliente: string;
      dataRef: string | null;
      turno: string | null;
    };
    portaria: {
      placa: string;
      motorista: string;
      cpf: string;
      transportadora: string;
      transportadoraId?: string | null;
      transportadoraCnpj?: string;
      checkinEm: string | null;
      ocrContainer: string;
      ocrPlaca: string;
      ocrPlacaCavalo?: string;
      ocrPlacaCarreta?: string;
      ocrPlacaCarreta02?: string;
      ocrLacre?: string;
      fotosLacre?: string[];
      fotosExtras: string[];
    };
  };
  qrToken?: string | null;
};

export type AguardandoChegadaItem = {
  protocolo: string;
  containerNumero: string;
  containerTipo: string;
  placa: string;
  clienteNome: string;
};

export async function fetchOperacao(protocolo: string): Promise<OperacaoDto> {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}`);
}

export async function fetchAguardandoChegada(search?: string) {
  const q = search?.trim() ? `?search=${encodeURIComponent(search)}` : "";
  return staffJson<{ items: AguardandoChegadaItem[] }>(`/v2/gate/aguardando-chegada${q}`);
}

export async function fetchPortariaStats() {
  return staffJson<{
    aguardandoChegada: number;
    emVistoria: number;
    aguardandoGate: number;
    concluidasHoje: number;
  }>("/v2/gate/portaria/stats");
}

export async function postCheckin(protocolo: string) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/checkin`, {
    method: "POST",
  });
}

export async function postVistoria(
  protocolo: string,
  body: {
    fotos: Array<{
      tipo: string;
      imagem: string;
      ocrResult?: string;
      ocrMatch?: boolean;
      ocrConfianca?: number;
      ocrProvider?: string;
      ocrTextoBruto?: string;
      ocrExtras?: ContainerOcrExtras;
    }>;
    avarias: Array<{ foto: string; descricao: string; localizacao: string }>;
  },
) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/vistoria`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchStaffCatalogoContainer(iso: string) {
  return staffJson<import("@/lib/catalogo-container-iso").CatalogoContainerIso | null>(
    `/v2/catalogo-containers/${encodeURIComponent(iso)}`,
  );
}

export async function fetchStaffCatalogoNavios(q?: string) {
  const query = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return staffJson<{ items: Array<{ nome: string; origem: string }>; total: number }>(
    `/v2/catalogo-navios${query}`,
  );
}

export async function processarOcr(imagem: string, tipo: "CONTAINER" | "PLACA", esperado?: string) {
  return staffJson<{
    sucesso: boolean;
    texto: string;
    textoBruto?: string;
    confianca: number;
    provider: string;
    ocrMatch: boolean;
    extras?: ContainerOcrExtras;
    erro?: string;
  }>("/v2/ocr/processar", {
    method: "POST",
    body: JSON.stringify({ imagem, tipo, esperado }),
  });
}

export async function fetchReconfirmacoes() {
  return staffJson<{ items: OperacaoDto[] }>("/v2/gate/reconfirmacoes");
}

export async function fetchReconfirmacoesCount() {
  return staffJson<{ count: number }>("/v2/gate/reconfirmacoes/count");
}

export async function fetchControleEntradaSaida() {
  return staffJson<{
    items: OperacaoDto[];
    count: number;
    aConferir: number;
    ricPendente: number;
    prontoSaida?: number;
  }>("/v2/gate/controle-entrada-saida");
}

export type ConsultaRicLeg = {
  em: string;
  protocolo: string;
  operacao: string;
  motorista: string;
  placaCavalo: string;
  placaCarreta: string;
  booking: string;
  processo: string;
  navio: string;
  situacao: string;
};

export type ConsultaRicItem = {
  id: string;
  numero: number;
  label: string;
  unidadeIso: string;
  status: "ABERTO" | "ENCERRADO";
  tipoContainer?: string | null;
  tamanhoContainer?: string | null;
  situacao?: string | null;
  lacre?: string | null;
  lacreTroca?: {
    atual: string;
    anterior: string;
    observacao: string;
    origem: string;
    texto: string;
  } | null;
  tomadaReefer?: boolean;
  tomadaConectada?: boolean;
  handlingValor?: number;
  valorLancado?: number;
  clienteNome: string;
  titularNome?: string;
  solicitanteNome?: string;
  entrada: ConsultaRicLeg;
  saida: ConsultaRicLeg | null;
};

export async function fetchConsultaRic(params: {
  q?: string;
  direcao?: "ENTRADA" | "SAIDA" | "TODAS";
  de?: string;
  ate?: string;
  status?: "ABERTO" | "ENCERRADO" | "TODOS";
}) {
  const qs = new URLSearchParams();
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.direcao && params.direcao !== "TODAS") qs.set("direcao", params.direcao);
  if (params.de) qs.set("de", params.de);
  if (params.ate) qs.set("ate", params.ate);
  if (params.status && params.status !== "TODOS") qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return staffJson<{ items: ConsultaRicItem[] }>(`/v2/gate/consulta-ric${suffix}`);
}

export async function fetchControleEntradaSaidaCount() {
  return staffJson<{
    count: number;
    aConferir: number;
    ricPendente: number;
    prontoSaida?: number;
  }>("/v2/gate/controle-entrada-saida/count");
}

export type GateUnidadeNotificacaoCampo = {
  campo: string;
  label: string;
  antes: string;
  depois: string;
};

export type GateUnidadeNotificacao = {
  id: string;
  titulo: string;
  corpo: string;
  origem: "PORTAL" | "GATE";
  unidadeIso: string;
  processoNumero: number;
  unidadeProcessoId: string;
  campos: GateUnidadeNotificacaoCampo[];
  atorNome: string;
  atorRole: string;
  criadoEm: string;
  lidaEm: string | null;
  href: string;
};

export async function fetchGateNotificacoes() {
  return staffJson<GateUnidadeNotificacao[]>("/v2/gate/notificacoes");
}

export async function fetchGateNotificacoesNaoLidas() {
  return staffJson<{ count: number }>("/v2/gate/notificacoes/nao-lidas");
}

export async function marcarGateNotificacaoLida(id: string) {
  return staffJson<GateUnidadeNotificacao>(
    `/v2/gate/notificacoes/${encodeURIComponent(id)}/lida`,
    { method: "POST" },
  );
}

export async function marcarTodasGateNotificacoesLidas() {
  return staffJson<{ atualizadas: number }>("/v2/gate/notificacoes/marcar-todas-lidas", {
    method: "POST",
  });
}

export type CatalogoTipoContainer = {
  codigo: string;
  nome: string;
  tamanhos: string[];
  tomadaReefer: boolean;
};

export type CatalogoTransportadora = {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  label: string;
};

export type CatalogosConferencia = {
  tiposContainer: CatalogoTipoContainer[];
  transportadoras?: CatalogoTransportadora[];
};

export async function fetchCatalogosConferencia() {
  return staffJson<CatalogosConferencia>("/v2/gate/catalogos-conferencia");
}

export async function postCorrecoesGate(
  protocolo: string,
  body: {
    container?: string;
    tipo?: string;
    tamanho?: string;
    situacao?: string;
    booking?: string;
    processo?: string;
    navio?: string;
    lacre?: string;
    placaCavalo?: string;
    placaCarreta?: string;
    placaCarreta02?: string;
    tipoCaminhao?: string;
    motorista?: string;
    cpf?: string;
    transportadora?: string;
    transportadoraId?: string;
    observacao?: string;
    confirmar?: string[];
    gerenteToken?: string;
    motivo?: string;
  },
) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/correcoes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postAutorizacaoGerente(
  protocolo: string,
  documento: string,
  password: string,
) {
  return staffJson<{
    token: string;
    expiresIn: string;
    email: string;
    role: string;
    gerenteId: string;
  }>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/autorizacao-gerente`, {
    method: "POST",
    body: JSON.stringify({ documento, password }),
  });
}

export async function postExcluirRic(
  protocolo: string,
  body: { gerenteToken?: string; documento?: string; password?: string },
) {
  return staffJson<{ ok: boolean; direcao: string; idLabel: string }>(
    `/v2/gate/operacoes/${encodeURIComponent(protocolo)}/excluir`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function postReconfirmar(protocolo: string, checklist: Record<string, boolean> = {}) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/reconfirmar`, {
    method: "POST",
    body: JSON.stringify({ checklist }),
  });
}

export async function postDevolverPortaria(protocolo: string, fotosRefazer: string[]) {
  return staffJson<OperacaoDto>(
    `/v2/gate/operacoes/${encodeURIComponent(protocolo)}/devolver-portaria`,
    {
      method: "POST",
      body: JSON.stringify({ motivo: "FOTOS_REFAZER", fotosRefazer }),
    },
  );
}

export async function postRejeitar(protocolo: string, motivo: string, etapa: string) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/rejeitar`, {
    method: "POST",
    body: JSON.stringify({ motivo, etapa }),
  });
}

export async function postAssinatura(
  protocolo: string,
  body: { modo: "DIGITAL" | "MANUAL"; assinatura?: string; biometriaVerificada?: boolean },
) {
  return staffJson<OperacaoDto>(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/assinatura`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function downloadRicPdf(
  protocolo: string,
  modelo?: "dupla" | "cupom" | "completa",
): Promise<Blob> {
  const qs = modelo ? `?modelo=${modelo}` : "";
  const res = await staffRequest(`/v2/gate/operacoes/${encodeURIComponent(protocolo)}/ric-pdf${qs}`, {
    method: "POST",
    headers: { Accept: "application/pdf" },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(nestErrorMessage(err, res.status), res.status);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/pdf")) {
    throw new Error(`Resposta inválida: esperado application/pdf, recebido ${contentType || "desconhecido"}`);
  }
  return res.blob();
}

export async function postLiberarOperacao(protocolo: string) {
  return staffJson<OperacaoDto>(
    `/v2/gate/operacoes/${encodeURIComponent(protocolo)}/liberar-operacao`,
    { method: "POST" },
  );
}

export async function fetchEquipamentoAtual() {
  try {
    return await staffJson<{ id: string; codigo: string; marca: string; modelo: string }>(
      "/v2/cadastros/operacional-vinculo/equipamento-atual",
    );
  } catch {
    return null;
  }
}

export type CessaoCliente = {
  id: string;
  nome: string;
  razaoSocial: string;
  cpfCnpj: string;
};

export type CessaoPreview = {
  unidadeProcessoId: string;
  idLabel: string;
  unidadeIso: string;
  statusProcesso: string;
  etapa: "DURANTE_ESTADIA" | "POS_SAIDA" | "POS_NFSE";
  bloqueioPago: boolean;
  aguardandoCancelamentoNfse: boolean;
  cessaoPendenteId: string | null;
  solicitante: CessaoCliente;
  titular: CessaoCliente;
  fatura: {
    id: string;
    valorTotal: number;
    statusPagamento: string;
    nfse: boolean;
    linkNfse: string | null;
    numeroRps: string | null;
  } | null;
  preFaturaAberta: { valorAcumulado: number; segmento: number } | null;
  historico: Array<{
    id: string;
    etapa: string;
    status: string;
    motivo: string;
    vigenteEm: string;
    de: CessaoCliente;
    para: CessaoCliente;
    comprovante: { nome: string; mime: string | null; tamanho: number | null } | null;
  }>;
  avisos: string[];
};

export async function fetchCessaoPreview(unidadeProcessoId: string) {
  return staffJson<CessaoPreview>(
    `/v2/gate/cessao-titularidade/${encodeURIComponent(unidadeProcessoId)}`,
  );
}

export async function fetchCessaoClientes(q: string, excluirId?: string) {
  const qs = new URLSearchParams({ q });
  if (excluirId) qs.set("excluirId", excluirId);
  return staffJson<{ items: CessaoCliente[] }>(`/v2/gate/cessao-titularidade/clientes?${qs}`);
}

export async function postCessaoAutorizacaoGerente(
  unidadeProcessoId: string,
  documento: string,
  password: string,
) {
  return staffJson<{
    token: string;
    expiresIn: string;
    email: string;
    role: string;
    gerenteId: string;
  }>(
    `/v2/gate/cessao-titularidade/${encodeURIComponent(unidadeProcessoId)}/autorizacao-gerente`,
    { method: "POST", body: JSON.stringify({ documento, password }) },
  );
}

export async function postExecutarCessao(
  unidadeProcessoId: string,
  body: {
    paraClienteId: string;
    motivo: string;
    gerenteToken: string;
    comprovante: File;
  },
) {
  const fd = new FormData();
  fd.append("paraClienteId", body.paraClienteId);
  fd.append("motivo", body.motivo);
  fd.append("gerenteToken", body.gerenteToken);
  fd.append("comprovante", body.comprovante);
  return staffJson<{
    id: string;
    etapa: string;
    status: string;
    idLabel: string;
    de: CessaoCliente;
    para: CessaoCliente;
  }>(`/v2/gate/cessao-titularidade/${encodeURIComponent(unidadeProcessoId)}`, {
    method: "POST",
    body: fd,
  });
}

export async function fetchCessaoPendenciasNfse() {
  return staffJson<{
    items: Array<{
      id: string;
      idLabel: string;
      unidadeIso: string;
      protocoloEntrada: string;
      de: CessaoCliente;
      para: CessaoCliente;
      motivo: string;
      faturaOrigemId: string | null;
      vigenteEm: string;
      comprovante: { nome: string; mime: string | null; tamanho: number | null } | null;
    }>;
  }>("/v2/gate/cessao-titularidade/pendencias-nfse");
}

export async function abrirCessaoComprovante(cessaoId: string) {
  const res = await staffRequest(
    `/v2/gate/cessao-titularidade/${encodeURIComponent(cessaoId)}/comprovante`,
    { headers: { Accept: "*/*" } },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new ApiError(err || `Erro HTTP ${res.status}`, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function postConfirmarReemissaoCessao(cessaoId: string, observacao?: string) {
  return staffJson<{ id: string; status: string; faturaDestinoId: string; valor: number }>(
    `/v2/gate/cessao-titularidade/${encodeURIComponent(cessaoId)}/confirmar-reemissao`,
    { method: "POST", body: JSON.stringify({ observacao }) },
  );
}
