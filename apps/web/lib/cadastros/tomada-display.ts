import { tipoRequerTomadaReefer } from "@/lib/cadastros/tipo-requer-tomada";

export function formatSetPointTomada(setPoint?: number | string | null): string | null {
  if (setPoint == null) return null;
  const raw = String(setPoint).trim().replace(",", ".");
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return `${raw}°C`;
  return `${n}°C`;
}

/** Texto da escolha na solicitação. Null se o tipo não requer tomada. */
export function rotuloTomadaPedido(opts: {
  tipo?: string | null;
  refrigerado?: boolean | null;
  setPoint?: number | string | null;
  tipos?: Array<{ codigo: string; tomadaReefer: boolean }>;
}): string | null {
  if (!tipoRequerTomadaReefer(opts.tipos ?? [], opts.tipo)) return null;
  if (opts.refrigerado) {
    const sp = formatSetPointTomada(opts.setPoint);
    return sp ? `Tomada Sim · ${sp}` : "Tomada Sim";
  }
  return "Tomada Não";
}
