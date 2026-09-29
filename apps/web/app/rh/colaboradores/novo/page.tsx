import Link from "next/link";
import { ColaboradorForm } from "@/app/cadastros/pessoas/colaboradores/components/colaborador-form";

export default function NovoColaboradorRhPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/rh" className="hover:text-white">
            RH
          </Link>
          <span>/</span>
          <Link href="/rh/colaboradores" className="hover:text-white">
            Colaboradores
          </Link>
          <span>/</span>
          <span>Novo</span>
        </div>
        <h1 className="text-2xl font-bold">Novo Colaborador</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastro da equipe — turno, perfil da intranet e senha. Login em /login/staff com o CPF.
        </p>
      </div>
      <ColaboradorForm basePath="/rh/colaboradores" />
    </div>
  );
}
