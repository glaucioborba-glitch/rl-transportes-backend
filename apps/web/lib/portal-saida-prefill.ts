import type { PortalPatioSaldoItem } from "@/lib/api/portal-client";
import { stripContainerISO } from "@/utils/containerFormatter";

const KEY = "rl.portal.saidaPrefill";

export function stashPortalSaidaPrefill(item: PortalPatioSaldoItem) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(item));
}

export function peekPortalSaidaPrefill(iso: string | null | undefined): PortalPatioSaldoItem | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const item = JSON.parse(raw) as PortalPatioSaldoItem;
    const want = stripContainerISO(iso ?? "");
    const got = stripContainerISO(item.unidadeIso ?? "");
    if (!want || got !== want) return null;
    return item;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function clearPortalSaidaPrefill() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(KEY);
}
