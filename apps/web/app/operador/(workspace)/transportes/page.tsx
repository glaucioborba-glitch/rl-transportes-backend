"use client";

import Link from "next/link";
import { ChevronRight, Send, SquareArrowOutUpRight, Truck } from "lucide-react";

export default function TransportesLandingPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Transportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operação de frota e embarques. A planilha de Fretes abre em outra aba para ganhar espaço.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/operador/fretes"
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-[var(--accent)]/40 hover:bg-white/[0.02]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--accent)]/10">
              <Truck className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <SquareArrowOutUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-base font-semibold">Fretes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quadro tipo planilha — estágio por cor, edição nas células. Abre em nova aba.
          </p>
        </Link>

        <Link
          href="/operador/dispatch"
          className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-[var(--accent)]/40 hover:bg-white/[0.02]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--accent)]/10">
              <Send className="h-5 w-5 text-[var(--accent)]" />
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <h2 className="mt-4 text-base font-semibold">Dispatch Board</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Arraste agendamentos de frota FL para o motorista disponível.
          </p>
        </Link>
      </div>
    </div>
  );
}