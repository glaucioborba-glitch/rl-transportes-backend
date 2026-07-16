"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ClienteDetail } from "../components/cliente-detail";
import { ClienteForm } from "../components/cliente-form";
import { getCadastrosCliente, type CadastrosClienteFormData } from "@/lib/api/cadastros-clientes-client";
import { toast } from "@/lib/toast";

type Props = {
  params: { id: string };
};

export default function ClienteDetailPage({ params }: Props) {
  const [cliente, setCliente] = useState<CadastrosClienteFormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    void (async () => {
      try {
        const data = await getCadastrosCliente(params.id);
        if (on) setCliente(data);
      } catch {
        toast.error("Cliente não encontrado.");
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Carregando…
      </div>
    );
  }

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
          <span>Editar</span>
        </div>
        <h1 className="text-2xl font-bold">Editar Cliente</h1>
      </div>

      {cliente ? <ClienteDetail cliente={cliente} clienteId={params.id} /> : null}
      <ClienteForm clienteId={params.id} />
    </div>
  );
}
