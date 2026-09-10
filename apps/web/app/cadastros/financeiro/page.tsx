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
          Bancos, centros de custo, plano de contas, tabelas de preços, tabela de transportes, serviços, aluguel e forma/prazo
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
          </Link>{" "}
          ou{" "}
          <Link href="/cadastros/financeiro/transportes" className="text-[var(--accent)] hover:underline">
            Tabela de transportes
          </Link>{" "}
          ou{" "}
          <Link href="/cadastros/financeiro/servicos" className="text-[var(--accent)] hover:underline">
            Serviços
          </Link>{" "}
          ou{" "}
          <Link href="/cadastros/financeiro/aluguel" className="text-[var(--accent)] hover:underline">
            Aluguel
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
