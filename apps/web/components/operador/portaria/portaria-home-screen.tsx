"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, QrCode, ScanLine, Search } from "lucide-react";
import { QrScanner } from "@/components/operador/portaria/qr-scanner";
import { BuscaUnidade } from "@/components/operador/portaria/busca-unidade";
import { fetchPortariaStats } from "@/lib/gate/operacao-api";

export function PortariaHomeScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "scan" | "search">("menu");
  const [stats, setStats] = useState({
    aguardandoChegada: 0,
    emVistoria: 0,
    aguardandoGate: 0,
    concluidasHoje: 0,
  });

  useEffect(() => {
    void fetchPortariaStats()
      .then(setStats)
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-6 p-4">
      <div className="pt-4 text-center">
        <h1 className="text-2xl font-bold text-white">Portaria</h1>
        <p className="mt-1 text-sm text-slate-400">Faça check-in da unidade que chegou</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
          <Clock className="mx-auto mb-1 h-5 w-5 text-amber-400" />
          <p className="text-2xl font-bold tabular-nums text-white">{stats.aguardandoChegada}</p>
          <p className="text-xs text-slate-400">Aguardando chegada</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
          <ScanLine className="mx-auto mb-1 h-5 w-5 text-blue-400" />
          <p className="text-2xl font-bold tabular-nums text-white">{stats.emVistoria}</p>
          <p className="text-xs text-slate-400">Em vistoria</p>
        </div>
      </div>

      {mode === "menu" && (
        <div className="space-y-3 pt-4">
          <button
            type="button"
            onClick={() => setMode("scan")}
            className="flex w-full flex-col items-center gap-2 rounded-xl bg-[var(--accent)] p-6 text-black transition-colors hover:opacity-90"
          >
            <QrCode className="h-10 w-10" />
            <span className="text-lg font-bold">Escanear QR Code</span>
            <span className="text-sm opacity-80">Motorista apresenta o QR na tela</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("search")}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-6 transition-colors hover:border-[var(--accent)]/30"
          >
            <Search className="h-10 w-10 text-[var(--accent)]" />
            <span className="text-lg font-bold text-white">Buscar Unidade</span>
            <span className="text-sm text-slate-400">Pesquisar nas programadas para hoje</span>
          </button>
        </div>
      )}

      {mode === "scan" && (
        <QrScanner
          onScan={(protocolo) => router.push(`/operador/portaria/checkin/${encodeURIComponent(protocolo)}`)}
          onCancel={() => setMode("menu")}
        />
      )}

      {mode === "search" && (
        <BuscaUnidade
          onSelect={(protocolo) =>
            router.push(`/operador/portaria/checkin/${encodeURIComponent(protocolo)}`)
          }
          onCancel={() => setMode("menu")}
        />
      )}
    </div>
  );
}
