import { redirect } from "next/navigation";

/** /portal sem segmento → solicitações (home operacional pós-login). */
export default function PortalRootPage() {
  redirect("/portal/solicitacoes");
}
