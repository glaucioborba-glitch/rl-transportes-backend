import { redirect } from "next/navigation";

/** Cadastro sem uso operacional — o menu foi removido. */
export default function TiposOperacaoRemovedPage() {
  redirect("/cadastros/operacional");
}
