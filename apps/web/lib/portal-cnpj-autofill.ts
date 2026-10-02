/** Preferência do toggle — apenas formulário `/portal/cadastrar` (sessionStorage). */
export const AUTO_PREENCHER_CNPJ_KEY = "autoPreencherCnpj";

export function readAutoPreencherCnpjPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = sessionStorage.getItem(AUTO_PREENCHER_CNPJ_KEY);
    if (raw === "0" || raw === "false") return false;
    if (raw === "1" || raw === "true") return true;
  } catch {
    /* storage indisponível */
  }
  return true;
}

export function writeAutoPreencherCnpjPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(AUTO_PREENCHER_CNPJ_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}
