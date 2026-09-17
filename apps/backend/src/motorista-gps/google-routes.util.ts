export const ITAJAI_TERMINAL = { lat: -26.907, lng: -48.661 };

export type EnderecoTerminal = {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
};

export type DestinoTerminal =
  | { kind: "latLng"; lat: number; lng: number }
  | { kind: "address"; address: string };

export function parseGoogleDurationSeconds(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(raw.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function minutosDeSegundos(seconds: number): number {
  return Math.max(0, Math.round(seconds / 60));
}

export function montarEnderecoTerminal(e: EnderecoTerminal): string | null {
  const rua = [e.logradouro, e.numero].map((s) => (s ?? "").trim()).filter(Boolean).join(", ");
  const cidadeUf = [e.cidade, e.uf].map((s) => (s ?? "").trim()).filter(Boolean).join(" - ");
  const parts = [rua, (e.complemento ?? "").trim(), (e.bairro ?? "").trim(), cidadeUf, (e.cep ?? "").trim()].filter(
    Boolean,
  );
  if (!rua && !cidadeUf) return null;
  return parts.join(", ");
}

export function arredondarCoordCache(n: number): string {
  return n.toFixed(4);
}

export function chaveDestinoRota(destino: DestinoTerminal): string {
  return destino.kind === 'address'
    ? `a:${destino.address}`
    : `g:${arredondarCoordCache(destino.lat)}:${arredondarCoordCache(destino.lng)}`;
}
