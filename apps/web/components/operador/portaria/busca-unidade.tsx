"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Search, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAguardandoChegada, type AguardandoChegadaItem } from "@/lib/gate/operacao-api";

type Props = {
  onSelect: (protocolo: string) => void;
  onCancel: () => void;
};

export function BuscaUnidade({ onSelect, onCancel }: Props) {
  const [search, setSearch] = useState("");
  const [resultados, setResultados] = useState<AguardandoChegadaItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function buscar() {
    if (search.length < 2) return;
    setLoading(true);
    try {
      const data = await fetchAguardandoChegada(search);
      setResultados(data.items ?? []);
    } catch {
      setResultados([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="protocol-input"
            placeholder="Protocolo, contêiner ou placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void buscar()}
            className="h-12 pl-12 text-base"
            autoFocus
          />
        </div>
        <Button
          type="button"
          data-testid="search-credential-btn"
          className="h-12 shrink-0 px-4"
          onClick={() => void buscar()}
        >
          Buscar
        </Button>
      </div>

      {loading && (
        <div className="py-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      <div className="space-y-2">
        {resultados.map((item) => (
          <button
            key={item.protocolo}
            type="button"
            onClick={() => onSelect(item.protocolo)}
            className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{item.protocolo}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.containerNumero} · {item.containerTipo} · {item.placa}
              </p>
              <p className="truncate text-xs text-muted-foreground">{item.clienteNome}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ))}

        {!loading && resultados.length === 0 && search.length >= 2 && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma unidade encontrada para &quot;{search}&quot;.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Verifique se a solicitação foi aprovada pelo Gate.
            </p>
          </div>
        )}
      </div>

      <Button variant="outline" className="w-full" onClick={onCancel}>
        <X className="mr-2 h-4 w-4" /> Voltar
      </Button>
    </div>
  );
}
