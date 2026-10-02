import { getApiBase } from "@/lib/api/corporate-auth-client";

import { staffJson } from "@/lib/api/staff-client";



export type TenantTurnoOperacionalConfig = {
  id: string;
  codigo: string;
  slot: "MANHA" | "TARDE";
  nome: string;
  horaInicio: string;
  horaFim: string;
  capacidadeMaxima: number;
  diasSemana: string[];
  ativo: boolean;
};

export type ToleranciaChegadaConfig = {
  tipo: "dia" | "turno" | "horario";
  valorMin: number;
  ativo: boolean;
};

export type TenantFeriadoMunicipal = {
  data: string;
  nome: string;
};

export type FeriadoNacionalApi = {
  date: string;
  name: string;
  type: string;
};

export type FeriadosResponse = {
  nacionais: FeriadoNacionalApi[];
  municipais: TenantFeriadoMunicipal[];
};

export type FeriadoListItem = {
  data: string;
  nome: string;
  tipo: string;
  municipal: boolean;
};

export type CapacidadeCalcResponse = {
  capacidadeCalculada: number;
};

export type TenantTurnoConfig = {
  id: string;
  nome: string;
  inicio: string;
  fim: string;
  slot?: "MANHA" | "TARDE";
};

/** API de solicitação só aceita MANHA/TARDE — o select pode usar código MDM. */
export function resolveAgendamentoTurno(
  turnos: TenantTurnoConfig[],
  selectedId: string,
): "MANHA" | "TARDE" {
  if (selectedId === "MANHA" || selectedId === "TARDE") return selectedId;
  const t = turnos.find((x) => x.id === selectedId);
  if (t?.slot === "MANHA" || t?.slot === "TARDE") return t.slot;
  const h = parseInt((t?.inicio ?? "12").split(":")[0] ?? "12", 10);
  return Number.isFinite(h) && h < 12 ? "MANHA" : "TARDE";
}

/** Turno operacional do instante atual (walk-in / Agendamento Rápido Particular). */
export function turnoOperacionalAgora(
  turnos: TenantTurnoConfig[],
  agora = new Date(),
): "MANHA" | "TARDE" {
  const hhmm = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  for (const t of turnos) {
    const ini = (t.inicio ?? "").slice(0, 5);
    const fim = (t.fim ?? "").slice(0, 5);
    if (ini && fim && hhmm >= ini && hhmm < fim) {
      return resolveAgendamentoTurno(turnos, t.id);
    }
  }
  return agora.getHours() < 12 ? "MANHA" : "TARDE";
}



export type ReguaCobrancaConfig = {

  ativo?: boolean;

  diasPreVencimento?: number;

  diasAtrasoLeve?: number;

  diasPreBloqueio?: number;

  etapas?: {

    preVencimento?: boolean;

    vencimentoHoje?: boolean;

    atrasoLeve?: boolean;

    preBloqueio?: boolean;

  };

};



export type TenantParametrosOperacional = {
  capacidadeTotalSlots: number;
  teuMaximoSimultaneo: number;
  horarioFuncionamentoInicio: string;
  horarioFuncionamentoFim: string;
  freeTimePadraoDias: number;
  tatAlvoEntradaMin: number;
  tatAlvoSaidaMin: number;
  tatAlvoRemocaoMin: number;
  limiteAgendamentosPorTurno: number;
  operacaoFimSemana: boolean;
  /** Texto explicativo (UI) sobre operação/cobrança em fim de semana. */
  descricaoFimSemana?: string;
  toleranciaChegada: ToleranciaChegadaConfig;
  antecedenciaMinimaMin: number;
  cancelamentoSemPenalidadeMin: number;
  validarAntecedenciaAgendamento: boolean;
  validarCancelamentoSemPenalidade: boolean;
  /** Validade do QR unificado (cliente + Gate) após aprovação, em horas. */
  qrValidadeHoras: number;
  emailEnvio: string;
  emailEnvioNome: string;
  /** Servidor SMTP do terminal. Vazio = usa o SMTP do servidor (.env). */
  emailSmtpHost: string;
  emailSmtpPorta: number;
  emailSmtpUsuario: string;
  /** Só leitura: indica se já existe senha SMTP salva. */
  emailSmtpSenhaDefinida: boolean;
  turnos: TenantTurnoOperacionalConfig[];
  feriadosMunicipais: TenantFeriadoMunicipal[];
};



export type TenantParametrosFinanceiro = {

  diasToleranciaBloqueioPadrao: number;

  percentualMultaAtrasoPadrao: number;

  percentualJurosAoMesPadrao: number;

  condicaoPagamentoDefault: string;

  tabelaPrecoAtivaId: string | null;

  emiteNfseAutomatico: boolean;

  emiteBoletoAutomatico: boolean;

  diasVencimentoBoletoPadrao: number;

};



export type CertificadoStatus = "VALIDO" | "VENCIDO" | "AUSENTE" | "DESCONHECIDO";



export type TenantParametrosFiscal = {

  municipioIbge: string;

  provedor: "IPM" | "ATENDE_NET" | "NONE";

  regimeTributario: string;

  aliquotaIssPadrao: number;

  certificadoStatus: CertificadoStatus;

  certificadoValidade?: string;

};



export type TenantParametrosSeguranca = {

  tentativasLoginAntesBloqueio: number;

  duracaoBloqueioMin: number;

  sessoesMaximasConcorrentes: number;

  ttlSessaoHoras: number;

  senhaMinLength: number;

  senhaExigirMaiuscula: boolean;

  senhaExigirNumero: boolean;

  senhaExigirEspecial: boolean;

  senhaBloquearSequencias: boolean;

  validarDominioCorporativo: boolean;

};



export type IntegracaoOrigem = "env" | "tenant" | "none";

export type TenantIntegracaoStatus = {
  enabled: boolean;
  configured: boolean;
  origem: IntegracaoOrigem;
  lockedByEnv: boolean;
  phoneNumberId?: string;
  templatesAprovados?: number;
  apiKeyPresent?: boolean;
  clientEmail?: string;
  provider?: string;
  bucket?: string;
  endpoint?: string;
  region?: string;
  accessTokenPresent?: boolean;
  businessAccountIdPresent?: boolean;
  apiBaseUrl?: string;
};

export type TenantParametrosIntegracoes = {
  whatsapp: TenantIntegracaoStatus & {
    phoneNumberId?: string;
    templatesAprovados: number;
    accessTokenPresent: boolean;
    businessAccountIdPresent: boolean;
  };
  googleVision: TenantIntegracaoStatus & { apiKeyPresent: boolean; clientEmail?: string };
  googleMaps: TenantIntegracaoStatus & { apiKeyPresent: boolean };
  googleRoutes: TenantIntegracaoStatus & { apiKeyPresent: boolean };
  banking: TenantIntegracaoStatus & { apiBaseUrl?: string };
  boleto: TenantIntegracaoStatus & { apiBaseUrl?: string };
  pix: TenantIntegracaoStatus & {
    apiBaseUrl?: string;
    chavePixPresent: boolean;
    chavePixHint?: string;
    apiTokenPresent: boolean;
  };
  s3: TenantIntegracaoStatus & { bucket?: string; endpoint?: string; region?: string };
};



export type WhatsAppTemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "DISABLED";



export type TenantParametrosNotificacoes = {

  emailsAlerta: string[];

  webhookSlackUrl?: string;

  webhookSlackEnabled: boolean;

  debounceAlertasMin: number;

  templatesWhatsApp: { name: string; status: WhatsAppTemplateStatus }[];

};



export type ParametrosGeraisResponse = {

  tenantId: string;

  operacional: TenantParametrosOperacional;

  financeiro: TenantParametrosFinanceiro;

  fiscal: TenantParametrosFiscal;

  seguranca: TenantParametrosSeguranca;

  integracoes?: TenantParametrosIntegracoes;

  notificacoes: TenantParametrosNotificacoes;

  reguaCobranca: ReguaCobrancaConfig;

  turnos: TenantTurnoConfig[];

};



export type IntegrationTestResult = {

  connected: boolean;

  message: string;

  latency?: number;

};



export type FeatureFlagRow = {

  chave: string;

  ativo: boolean;

  descricao?: string | null;

  regras?: Record<string, unknown> | null;

};



export type ReguaCobrancaResponse = {

  tenantId: string;

  reguaCobranca: ReguaCobrancaConfig;

};



export type TenantParametrosResponse = {

  tenantId: string;

  nome: string;

  parametros: {

    branding?: { corPrimaria?: string; logoUrl?: string };

    operacao?: {

      turnos?: TenantTurnoConfig[];

      exigeInspecaoGateIn?: boolean;

      diasFreeTimePadrao?: number;

    };

    reguaCobranca?: ReguaCobrancaConfig;

  };

};



const FALLBACK_TURNOS: TenantTurnoConfig[] = [

  { id: "MANHA", nome: "Manhã", inicio: "06:00", fim: "14:00", slot: "MANHA" },

  { id: "TARDE", nome: "Tarde", inicio: "14:00", fim: "22:00", slot: "TARDE" },

];



export async function fetchTenantTurnos(tenantId = "default"): Promise<TenantTurnoConfig[]> {
  void tenantId;
  try {
    const data = await staffJson<TenantTurnoConfig[]>("/tenant-config/turnos");
    return data?.length ? data : FALLBACK_TURNOS;
  } catch {
    return FALLBACK_TURNOS;
  }
}



export async function fetchTenantConfigMe(cookieMode = true): Promise<TenantParametrosResponse | null> {

  try {

    const headers: Record<string, string> = { Accept: "application/json" };

    if (cookieMode) headers["X-RL-Auth-Cookie"] = "1";

    const res = await fetch(`${getApiBase()}/tenant-config/me`, {

      credentials: "include",

      headers,

      cache: "no-store",

    });

    if (!res.ok) return null;

    return (await res.json()) as TenantParametrosResponse;

  } catch {

    return null;

  }

}



export async function fetchReguaCobranca(): Promise<ReguaCobrancaResponse | null> {

  try {

    return await staffJson<ReguaCobrancaResponse>("/tenant-config/regua-cobranca");

  } catch {

    return null;

  }

}



export async function patchReguaCobranca(body: ReguaCobrancaConfig): Promise<ReguaCobrancaResponse> {

  return staffJson<ReguaCobrancaResponse>("/tenant-config/regua-cobranca", {

    method: "PATCH",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify(body),

  });

}



export async function fetchParametrosGerais(): Promise<ParametrosGeraisResponse> {

  return staffJson<ParametrosGeraisResponse>("/tenant-config/parametros-gerais");

}



export type ParametrosGeraisPatch = {

  operacional?: Partial<TenantParametrosOperacional> & {
    /** Só escrita: string vazia apaga a senha SMTP salva. */
    emailSmtpSenha?: string;
  };

  financeiro?: Partial<TenantParametrosFinanceiro>;

  fiscal?: Partial<TenantParametrosFiscal> & {

    certificadoBase64?: string;

    certificadoSenha?: string;

  };

  seguranca?: Partial<TenantParametrosSeguranca>;

  notificacoes?: Partial<TenantParametrosNotificacoes>;

  integracoes?: {
    googleVision?: { credentialsJson?: string; apiKey?: string };
    whatsapp?: {
      enabled?: boolean;
      phoneNumberId?: string;
      accessToken?: string;
      businessAccountId?: string;
    };
    banking?: { apiBaseUrl?: string; apiToken?: string };
    boleto?: { apiBaseUrl?: string; apiToken?: string };
    pix?: { apiBaseUrl?: string; apiToken?: string; chavePix?: string };
    googleMaps?: { apiKey?: string };
    googleRoutes?: { apiKey?: string };
    s3?: {
      bucket?: string;
      endpoint?: string;
      region?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      publicBaseUrl?: string;
    };
  };
};



export async function patchParametrosGerais(
  body: ParametrosGeraisPatch,
): Promise<ParametrosGeraisResponse> {
  return staffJson<ParametrosGeraisResponse>("/tenant-config/parametros-gerais", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type EmailTesteResult = {
  enviado: boolean;
  origem: "tenant" | "env" | "none";
  from: string;
  mensagem: string;
};

export async function enviarEmailTeste(destinatario: string): Promise<EmailTesteResult> {
  return staffJson<EmailTesteResult>("/tenant-config/parametros-gerais/email-teste", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ destinatario }),
  });
}

export async function fetchCapacidadeCalculada(): Promise<CapacidadeCalcResponse> {
  return staffJson<CapacidadeCalcResponse>("/tenant-config/parametros-gerais/capacidade-calc");
}

export async function fetchFeriados(ano: number): Promise<FeriadosResponse> {
  return staffJson<FeriadosResponse>(`/tenant-config/parametros-gerais/feriados/${ano}`);
}

export async function addFeriadoMunicipal(body: TenantFeriadoMunicipal): Promise<{ ok: boolean }> {
  return staffJson("/tenant-config/parametros-gerais/feriados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function removeFeriadoMunicipal(data: string): Promise<{ ok: boolean }> {
  return staffJson(`/tenant-config/parametros-gerais/feriados/${encodeURIComponent(data)}`, {
    method: "DELETE",
  });
}



export async function testTenantIntegration(
  id: "ipm" | "whatsapp" | "google-vision" | "banking" | "s3",
): Promise<IntegrationTestResult> {
  return staffJson<IntegrationTestResult>(`/tenant-config/test/${id}`);
}

export type TenantMapsConfig = {
  configured: boolean;
  apiKey: string;
  terminalLat: number | null;
  terminalLng: number | null;
};

export async function fetchTenantMapsConfig(): Promise<TenantMapsConfig> {
  return staffJson<TenantMapsConfig>("/tenant-config/maps-config");
}



export async function revalidateWhatsappTemplates(): Promise<{

  templates: TenantParametrosNotificacoes["templatesWhatsApp"];

}> {

  return staffJson("/tenant-config/test/whatsapp-templates", { method: "POST" });

}



export async function testSlackWebhook(url: string): Promise<IntegrationTestResult> {

  return staffJson<IntegrationTestResult>("/tenant-config/test/slack-webhook", {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({ url }),

  });

}



export async function listAdminFeatureFlags(): Promise<FeatureFlagRow[]> {

  return staffJson<FeatureFlagRow[]>("/admin/feature-flags");

}



export async function patchAdminFeatureFlag(

  chave: string,

  body: { ativo: boolean },

): Promise<FeatureFlagRow> {

  return staffJson<FeatureFlagRow>(`/admin/feature-flags/${encodeURIComponent(chave)}`, {

    method: "PATCH",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify(body),

  });

}



export { FALLBACK_TURNOS };


