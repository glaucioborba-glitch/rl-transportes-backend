/** Allowlist do BFF Next → Nest. Qualquer outro path é 404. */
export function isPortalProxyPathAllowed(pathSegments: string[]): boolean {
  const n = `/${pathSegments.filter(Boolean).join("/")}`.replace(/\/+$/, "") || "/";
  if (n.startsWith("/cliente/")) return true;
  if (n.startsWith("/portal/")) return true;
  if (n.startsWith("/fornecedor/")) return true;
  if (n.startsWith("/client/container")) return true;
  return /^\/v2\/solicitacoes\/[^/]+\/pdf$/.test(n);
}
