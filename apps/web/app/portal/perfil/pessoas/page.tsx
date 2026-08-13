import { redirect } from "next/navigation";

/** Gestão de equipe integrada em /portal/perfil#equipe */
export default function PerfilPessoasRedirectPage() {
  redirect("/portal/perfil#equipe");
}
