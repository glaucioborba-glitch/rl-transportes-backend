import { redirect } from "next/navigation";

export default function LegacyGateDespachoPage() {
  redirect("/operador/gate/controle-entrada-saida");
}
