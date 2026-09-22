import { redirect } from "next/navigation";

/** Turnos ficam em Parâmetros → Operacional. */
export default function TurnosMovedPage() {
  redirect("/cadastros/parametros/operacional");
}
