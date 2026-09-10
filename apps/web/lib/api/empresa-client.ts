import { getApiBase } from "@/lib/api/corporate-auth-client";
import { staffJson, staffRequest } from "@/lib/api/staff-client";

export type EmpresaLogoSlot = "icone" | "horizontal" | "portal" | "documento" | "email";

export type EmpresaLogoMeta = {
  storageKey: string;
  mime: string;
  nome: string;
  tamanho: number;
  width: number | null;
  height: number | null;
  atualizadoEm: string;
  url: string;
};

export type EmpresaLogoSlotSpec = {
  slot: EmpresaLogoSlot;
  titulo: string;
  ondeAparece: string;
  descricao: string;
  formatos: string;
  dimensoes: string;
  tamanhoMax: string;
};

export type EmpresaOperadora = {
  tenantId: string;
  tenantNome: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  cnae: string;
  telefone: string;
  email: string;
  emailNf: string;
  emailFinanceiro: string;
  site: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  regimeTributario: "SIMPLES_NACIONAL" | "LUCRO_PRESUMIDO" | "LUCRO_REAL";
  simplesAnexo: string;
  aliquotaIss: number;
  aliquotaPis: number;
  aliquotaCofins: number;
  aliquotaCsll: number;
  aliquotaIrpj: number;
  logos: Partial<Record<EmpresaLogoSlot, EmpresaLogoMeta>>;
  slots: EmpresaLogoSlotSpec[];
  clienteLogoSpec: Omit<EmpresaLogoSlotSpec, "slot">;
  encargosHistorico?: EncargosSnapshot[];
};

export type EncargoLinha = {
  codigo: string;
  label: string;
  aliquotaPct: number;
  valor: number;
  entraNaSoma: boolean;
  nota?: string;
};

export type EncargosSnapshot = {
  id: string;
  competencia: string;
  dataInicio: string;
  dataFim: string;
  origemReceita: "MANUAL" | "FATURAS";
  receitaFaturada: number;
  qtdFaturas: number;
  empresa: string;
  regime: EmpresaOperadora["regimeTributario"];
  receita: number;
  linhas: EncargoLinha[];
  total: number;
  cargaEfetivaPct: number;
  avisos: string[];
  simuladoEm: string;
  status: "PROVISAO";
  geradoPor?: "CRON" | "USUARIO" | "PREVIA";
  parcial?: boolean;
  skipped?: boolean;
  motivo?: "ja_fechada" | "ja_gravada";
  historico?: EncargosSnapshot[];
};

export type EmpresaBrandingPublico = {
  tenantId: string;
  nome: string;
  razaoSocial: string;
  logos: Partial<Record<EmpresaLogoSlot, EmpresaLogoMeta>>;
};

export type ClienteLogoMeta = EmpresaLogoMeta & { clienteId: string };

export async function fetchEmpresaOperadora() {
  return staffJson<EmpresaOperadora>("/v2/cadastros/empresa");
}

export async function patchEmpresaOperadora(body: Partial<EmpresaOperadora>) {
  return staffJson<EmpresaOperadora>("/v2/cadastros/empresa", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function uploadEmpresaLogo(slot: EmpresaLogoSlot, file: File) {
  const fd = new FormData();
  fd.append("arquivo", file);
  return staffJson<EmpresaOperadora>(`/v2/cadastros/empresa/logos/${slot}`, {
    method: "POST",
    body: fd,
  });
}

export async function deleteEmpresaLogo(slot: EmpresaLogoSlot) {
  return staffJson<EmpresaOperadora>(`/v2/cadastros/empresa/logos/${slot}`, {
    method: "DELETE",
  });
}

export async function fetchClienteLogo(clienteId: string) {
  try {
    const res = await staffRequest(`/v2/cadastros/empresa/clientes/${encodeURIComponent(clienteId)}/logo`);
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    const json = JSON.parse(text) as ClienteLogoMeta | null;
    return json?.url ? json : null;
  } catch {
    return null;
  }
}

export async function uploadClienteLogo(clienteId: string, file: File) {
  const fd = new FormData();
  fd.append("arquivo", file);
  return staffJson<ClienteLogoMeta>(
    `/v2/cadastros/empresa/clientes/${encodeURIComponent(clienteId)}/logo`,
    { method: "POST", body: fd },
  );
}

export async function deleteClienteLogo(clienteId: string) {
  return staffJson<{ ok: boolean }>(
    `/v2/cadastros/empresa/clientes/${encodeURIComponent(clienteId)}/logo`,
    { method: "DELETE" },
  );
}

export function clienteLogoPublicUrl(clienteId: string, version?: string) {
  const q = version ? `?v=${encodeURIComponent(version)}` : "";
  return `${getApiBase()}/public/empresa/cliente-logo/${encodeURIComponent(clienteId)}${q}`;
}

export async function fetchEmpresaBrandingPublico(): Promise<EmpresaBrandingPublico | null> {
  try {
    const res = await fetch(`${getApiBase()}/public/empresa/branding`, {
      credentials: "omit",
    });
    if (!res.ok) return null;
    return (await res.json()) as EmpresaBrandingPublico;
  } catch {
    return null;
  }
}

export async function simularEmpresaEncargos(body: {
  competencia?: string;
  dataInicio?: string;
  dataFim?: string;
  receitaManual?: number;
  salvar?: boolean;
}) {
  return staffJson<EncargosSnapshot>("/v2/cadastros/empresa/encargos/simular", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchEmpresaEncargos() {
  return staffJson<{ items: EncargosSnapshot[] }>("/v2/cadastros/empresa/encargos");
}

export async function gerarEmpresaEncargosAgora() {
  return staffJson<EncargosSnapshot>("/v2/cadastros/empresa/encargos/gerar-agora", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
