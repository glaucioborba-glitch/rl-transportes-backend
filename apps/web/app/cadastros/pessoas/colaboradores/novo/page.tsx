import Link from "next/link";
import { ColaboradorForm } from "../components/colaborador-form";

export default function NovoColaboradorPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/pessoas" className="hover:text-white">
            Pessoas & Entidades
          </Link>
          <span>/</span>
          <Link href="/cadastros/pessoas/colaboradores" className="hover:text-white">
            Colaboradores
          </Link>
          <span>/</span>
          <span>Novo</span>
        </div>
        <h1 className="text-2xl font-bold">Novo Colaborador</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastro mestre — consumido por RH, Gate CPO e Financeiro.
        </p>
      </div>
      <ColaboradorForm />
    </div>
  );
}
