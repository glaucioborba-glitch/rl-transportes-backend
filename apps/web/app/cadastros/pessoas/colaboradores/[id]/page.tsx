"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ColaboradorDetail } from "../components/colaborador-detail";
import { ColaboradorForm } from "../components/colaborador-form";
import {
  getCadastrosColaborador,
  type CadastrosColaboradorFormData,
} from "@/lib/api/cadastros-colaboradores-client";
import { toast } from "@/lib/toast";

type Props = {
  params: { id: string };
};

export default function ColaboradorDetailPage({ params }: Props) {
  const [colaborador, setColaborador] = useState<CadastrosColaboradorFormData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    void (async () => {
      try {
        const data = await getCadastrosColaborador(params.id);
        if (on) setColaborador(data);
      } catch {
        toast.error("Colaborador não encontrado.");
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
          <Link href="/cadastros/pessoas/colaboradores" className="hover:text-white">
            Colaboradores
          </Link>
          <span>/</span>
          <span>Editar</span>
        </div>
        <h1 className="text-2xl font-bold">Editar Colaborador</h1>
      </div>

      {colaborador ? (
        <ColaboradorDetail colaborador={colaborador} colaboradorId={params.id} />
      ) : null}
      <ColaboradorForm colaboradorId={params.id} />
    </div>
  );
}
