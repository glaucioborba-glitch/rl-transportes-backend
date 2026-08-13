"use client";

import Link from "next/link";
import { DollarSign } from "lucide-react";
import { FinanceiroTabs } from "./components/financeiro-tabs";

export default function FinanceiroPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bloco 3 completo — Bancos, Centros de Custo, Plano de Contas e Tabelas de Preços
        </p>
      </div>

      <FinanceiroTabs />

      <div className="flex h-[40vh] flex-col items-center justify-center gap-3">
        <DollarSign className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-lg text-muted-foreground">Selecione uma sub-entidade acima.</p>
        <p className="text-sm text-muted-foreground/70">
          Comece por{" "}
          <Link href="/cadastros/financeiro/bancos" className="text-[var(--accent)] hover:underline">
            Bancos
          </Link>{" "}
          ou{" "}
          <Link
            href="/cadastros/financeiro/tabelas-precos"
            className="text-[var(--accent)] hover:underline"
          >
            Tabelas de Preços
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
