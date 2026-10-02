import type { PortalClienteSnapshot } from "@/lib/api/types";

/** Nome de exibição B2B: Nome Fantasia, depois Razão Social. */
export function resolvePortalClienteDisplayName(
  cliente: PortalClienteSnapshot | null | undefined,
  fallback?: string | null,
): string | null {
  const primary = cliente?.nomeFantasia?.trim() || cliente?.razaoSocial?.trim();
  if (primary) return primary;
  const fb = fallback?.trim();
  return fb || null;
}
