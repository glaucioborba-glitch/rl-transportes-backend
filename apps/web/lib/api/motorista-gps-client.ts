import { ApiError, getApiBase } from "@/lib/api/corporate-auth-client";
import { staffJson } from "@/lib/api/staff-client";

export type MotoristaGpsOrigem = "INTERNO" | "TERCEIRO";

export type MotoristaGpsSessao = {
  accessToken: string;
  motorista: {
    origem: MotoristaGpsOrigem;
    tipo: string;
    nome: string;
    placaCavalo: string | null;
  };
};

export type MotoristaGpsMapaItem = {
  origem: MotoristaGpsOrigem;
  cadastroId: string;
  nome: string;
  cpfMascara: string;
  placaCavalo: string | null;
  tipo: string;
  lat: number | null;
  lng: number | null;
  precisaoM: number | null;
  rastreando: boolean;
  online: boolean;
  atualizadoEm: string | null;
  etaMinutos?: number | null;
  etaAt?: string | null;
  distanciaM?: number | null;
  rotaPolyline?: string | null;
};

export function formatEtaChegada(item: Pick<MotoristaGpsMapaItem, "etaMinutos" | "etaAt">): string | null {
  if (item.etaMinutos == null || item.etaMinutos < 0) return null;
  const min = item.etaMinutos < 1 ? "menos de 1 min" : `${item.etaMinutos} min`;
  let hora = "";
  if (item.etaAt) {
    try {
      hora = new Date(item.etaAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      hora = "";
    }
  }
  return hora ? `Chegada ~${min} · ${hora}` : `Chegada ~${min}`;
}

export function motoristaGpsInfoHtml(item: MotoristaGpsMapaItem): string {
  const linha2 = [item.tipo, item.placaCavalo].filter(Boolean).join(" · ");
  const eta = formatEtaChegada(item);
  return `<strong>${item.nome}</strong><br/>${linha2}${eta ? `<br/>${eta}` : ""}`;
}

export type MotoristaGpsDestino = {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  cidade: string | null;
  uf: string | null;
  lat: number | null;
  lng: number | null;
};

export type MotoristaGpsMapaPayload = {
  destinoId: string | null;
  destinos: MotoristaGpsDestino[];
  items: MotoristaGpsMapaItem[];
};

export function motoristaGpsItemKey(item: Pick<MotoristaGpsMapaItem, "origem" | "cadastroId">): string {
  return `${item.origem}-${item.cadastroId}`;
}

export function motoristaGpsDestinoKey(id: string): string {
  return `destino-${id}`;
}

export function motoristaGpsDestinoHtml(d: MotoristaGpsDestino, selecionado: boolean): string {
  const lugar = [d.cidade, d.uf].filter(Boolean).join("/");
  return `<strong>${d.nome}</strong><br/>${d.codigo}${lugar ? ` · ${lugar}` : ""}${
    selecionado ? "<br/>Destino do ETA" : ""
  }`;
}

const GPS_TOKEN_KEY = "rl_motorista_gps_token";

export function readMotoristaGpsToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(GPS_TOKEN_KEY);
}

export function writeMotoristaGpsToken(token: string) {
  sessionStorage.setItem(GPS_TOKEN_KEY, token);
}

export function clearMotoristaGpsToken() {
  sessionStorage.removeItem(GPS_TOKEN_KEY);
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("Resposta inválida da API", res.status);
  }
}

function nestMessage(raw: string, status: number): string {
  try {
    const j = JSON.parse(raw) as { message?: string | string[] };
    if (Array.isArray(j.message) && j.message.length) return j.message.join(", ");
    if (typeof j.message === "string" && j.message.trim()) return j.message.trim();
  } catch {
    /* texto cru */
  }
  return raw || `Erro HTTP ${status}`;
}

async function gpsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readMotoristaGpsToken();
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  if (!res.ok) {
    const raw = await res.text();
    throw new ApiError(nestMessage(raw, res.status), res.status);
  }
  return parseJson<T>(res);
}

export async function motoristaGpsLogin(cpf: string, pin: string): Promise<MotoristaGpsSessao> {
  const session = await gpsRequest<MotoristaGpsSessao>("/v2/motorista-gps/login", {
    method: "POST",
    body: JSON.stringify({ cpf, pin }),
  });
  writeMotoristaGpsToken(session.accessToken);
  return session;
}

export async function motoristaGpsMe() {
  return gpsRequest<MotoristaGpsSessao["motorista"]>("/v2/motorista-gps/me");
}

export async function motoristaGpsPing(lat: number, lng: number, precisaoM?: number) {
  return gpsRequest<{ ok: true; atualizadoEm: string }>("/v2/motorista-gps/ping", {
    method: "POST",
    body: JSON.stringify({ lat, lng, precisaoM }),
  });
}

export async function motoristaGpsParar() {
  return gpsRequest<{ ok: true }>("/v2/motorista-gps/parar", { method: "POST" });
}

export async function fetchMotoristaLocalizacaoMapa(destinoId?: string | null): Promise<MotoristaGpsMapaPayload> {
  const qs = destinoId ? `?destinoId=${encodeURIComponent(destinoId)}` : "";
  return staffJson<MotoristaGpsMapaPayload>(`/v2/motorista-localizacao${qs}`);
}
