import Link from "next/link";
import { ClienteForm } from "../components/cliente-form";

export default function NovoClientePage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/pessoas" className="hover:text-white">
            Pessoas & Entidades
          </Link>
          <span>/</span>
          <Link href="/cadastros/pessoas/clientes" className="hover:text-white">
            Clientes
          </Link>
          <span>/</span>
          <span>Novo</span>
        </div>
        <h1 className="text-2xl font-bold">Novo Cliente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastro mestre — consumido por Gate, Financeiro, Admin e Portal.
        </p>
      </div>
      <ClienteForm />
    </div>
  );
}
