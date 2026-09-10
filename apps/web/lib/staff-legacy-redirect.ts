/** Destino canônico das URLs /staff (legado). */

export function staffLegacyRedirect(pathname: string): string | null {
  if (pathname === "/staff" || pathname === "/staff/") return "/operador/dashboard";
  if (pathname === "/staff/gate") return "/operador/gate/controle-entrada-saida";
  if (pathname.startsWith("/staff/gate/checkin/")) {
    const id = pathname.slice("/staff/gate/checkin/".length).split("/")[0];
    return id ? `/operador/gate/checkin/${id}` : "/operador/gate/fila";
  }
  if (pathname.startsWith("/staff/gate/checkout/")) {
    const id = pathname.slice("/staff/gate/checkout/".length).split("/")[0];
    return id ? `/operador/gate/checkout/${id}` : "/operador/gate/despacho";
  }
  if (pathname === "/staff/fila-operacional") return "/operador/gate/fila";
  if (pathname === "/staff/triagem") return "/operador/gate/triagem";
  if (pathname === "/staff/patio") return "/operador/patio";
  if (pathname === "/staff/consulta-container") return "/intranet/consulta-container";
  if (pathname === "/staff/solicitacoes-v2") return "/operador/gate/autorizacoes";
  if (pathname.startsWith("/staff/solicitacoes-v2/")) {
    const id = pathname.slice("/staff/solicitacoes-v2/".length).split("/")[0];
    return id ? `/operador/gate/autorizacoes/${id}` : "/operador/gate/autorizacoes";
  }
  if (pathname === "/staff/observabilidade") return "/admin/auditoria";
  if (pathname === "/staff/security") return "/grc/governanca";
  if (pathname === "/staff/perfil/dispositivos") return "/portal/perfil/dispositivos";
  if (pathname === "/staff/chaos" || pathname.startsWith("/staff/chaos/")) return "/admin/chaos";
  if (pathname.startsWith("/staff/")) return "/operador/dashboard";
  return null;
}
