import Link from "next/link";
import { MotoristaForm } from "../components/motorista-form";

export default function NovoMotoristaPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/pessoas" className="hover:text-white">
            Pessoas & Entidades
          </Link>
          <span>/</span>
          <Link href="/cadastros/pessoas/motoristas" className="hover:text-white">
            Motoristas
          </Link>
          <span>/</span>
          <span>Novo</span>
        </div>
        <h1 className="text-2xl font-bold">Novo Motorista</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastro mestre — vinculado a transportadora para Gate CPO.
        </p>
      </div>
      <MotoristaForm />
    </div>
  );
}
