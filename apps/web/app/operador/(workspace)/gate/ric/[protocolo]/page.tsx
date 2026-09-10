import { redirect } from "next/navigation";

export default function RicRedirectPage({ params }: { params: { protocolo: string } }) {
  redirect(`/operador/gate/controle-entrada-saida/${encodeURIComponent(params.protocolo)}`);
}
