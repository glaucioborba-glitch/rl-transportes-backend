import Link from "next/link";
import { BookOpen, History } from "lucide-react";
import { ClienteForm } from "../components/cliente-form";
import { Button } from "@/components/ui/button";
import { CADASTRO_PAGE_CLASS } from "@/components/cadastros/form-field";

type Props = {
  params: { id: string };
};

export default function ClienteDetailPage({ params }: Props) {
  return (
    <div className={CADASTRO_PAGE_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
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
            <span>Editar</span>
          </div>
          <h1 className="text-2xl font-bold">Editar cadastro</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/financeiro/conta-corrente/${params.id}`}>
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              Conta corrente
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/cadastros/pessoas/clientes/${params.id}/auditoria`}>
              <History className="mr-1.5 h-3.5 w-3.5" />
              Auditoria
            </Link>
          </Button>
        </div>
      </div>

      <ClienteForm key={params.id} clienteId={params.id} />
    </div>
  );
}
