"use client";

import Link from "next/link";
import { Database } from "lucide-react";
import { PessoasTabs } from "./components/pessoas-tabs";

export default function PessoasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pessoas & Entidades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clientes, Motoristas Internos, Motoristas externos, Transportadoras, Terceiros,
          Fornecedores, Visitantes. Colaboradores ficam em RH.
        </p>
      </div>

      <PessoasTabs />

      <div className="flex h-[50vh] flex-col items-center justify-center gap-3">
        <Database className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-lg text-muted-foreground">
          Selecione uma sub-entidade acima ou acesse{" "}
          <Link href="/cadastros/pessoas/clientes" className="text-[var(--accent)] hover:underline">
            Clientes
          </Link>
          {", "}
          <Link href="/rh/colaboradores" className="text-[var(--accent)] hover:underline">
            Colaboradores (RH)
          </Link>
          {", "}
          <Link
            href="/cadastros/pessoas/transportadoras"
            className="text-[var(--accent)] hover:underline"
          >
            Transportadoras
          </Link>
          {", "}
          <Link
            href="/cadastros/pessoas/motoristas"
            className="text-[var(--accent)] hover:underline"
          >
            Motoristas Internos
          </Link>
          {", "}
          <Link
            href="/cadastros/pessoas/motoristas-externos"
            className="text-[var(--accent)] hover:underline"
          >
            Motoristas externos
          </Link>{" "}
          ou{" "}
          <Link href="/cadastros/pessoas/terceiros" className="text-[var(--accent)] hover:underline">
            Terceiros
          </Link>
          .
        </p>
        <p className="text-sm text-muted-foreground/70">
          Fornecedores e Visitantes serão implementados nos próximos PRs.
        </p>
      </div>
    </div>
  );
}
