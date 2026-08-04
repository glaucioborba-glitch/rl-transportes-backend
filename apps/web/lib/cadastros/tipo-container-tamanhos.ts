export const TAMANHOS_CONTAINER_OPCOES = ["20", "40", "45"] as const;

export function normalizeTamanhoContainer(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/['"\s]/g, "").trim();
}

export function normalizeTamanhosContainer(values: unknown): string[] {
  const seen = new Set<string>();
  const raw = Array.isArray(values) ? values : [];
  for (const item of raw) {
    const n = normalizeTamanhoContainer(item);
    if (TAMANHOS_CONTAINER_OPCOES.includes(n as (typeof TAMANHOS_CONTAINER_OPCOES)[number])) {
      seen.add(n);
    }
  }
  return TAMANHOS_CONTAINER_OPCOES.filter((t) => seen.has(t));
}

export function formatTamanhoContainerDisplay(value: string): string {
  const n = normalizeTamanhoContainer(value);
  return n ? `${n}'` : "";
}

export function tamanhoContainerSelecionado(tamanhos: string[], opcao: string): boolean {
  const alvo = normalizeTamanhoContainer(opcao);
  return tamanhos.some((t) => normalizeTamanhoContainer(t) === alvo);
}
