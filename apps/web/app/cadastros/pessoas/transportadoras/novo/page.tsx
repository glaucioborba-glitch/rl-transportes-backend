import Link from "next/link";
import { TransportadoraForm } from "../components/transportadora-form";

export default function NovaTransportadoraPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/pessoas" className="hover:text-white">
            Pessoas & Entidades
          </Link>
          <span>/</span>
          <Link href="/cadastros/pessoas/transportadoras" className="hover:text-white">
            Transportadoras
          </Link>
          <span>/</span>
          <span>Nova</span>
        </div>
        <h1 className="text-2xl font-bold">Nova Transportadora</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastro mestre — consumido por Gate CPO e Dispatch.
        </p>
      </div>
      <TransportadoraForm />
    </div>
  );
}
