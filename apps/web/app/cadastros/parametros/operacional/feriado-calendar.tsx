"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Calendar, Loader2 } from "lucide-react";
import {
  addFeriadoMunicipal,
  fetchFeriados,
  removeFeriadoMunicipal,
  type FeriadoListItem,
} from "@/lib/api/tenant-config-client";

interface FeriadoCalendarProps {
  disabled?: boolean;
}

export function FeriadoCalendar({ disabled }: FeriadoCalendarProps) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const [feriados, setFeriados] = useState<FeriadoListItem[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [novaData, setNovaData] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFeriados(ano);
      const nacionais: FeriadoListItem[] = res.nacionais.map((f) => ({
        data: f.date,
        nome: f.name,
        tipo: f.type ?? "Nacional",
        municipal: false,
      }));
      const municipais: FeriadoListItem[] = res.municipais.map((f) => ({
        data: f.data,
        nome: f.nome,
        tipo: "Municipal",
        municipal: true,
      }));
      setFeriados(
        [...nacionais, ...municipais].sort((a, b) => a.data.localeCompare(b.data)),
      );
    } finally {
      setLoading(false);
    }
  }, [ano]);

  useEffect(() => {
    void load();
  }, [load]);

  const addFeriado = async () => {
    if (!novaData || !novoNome.trim()) return;
    await addFeriadoMunicipal({ data: novaData, nome: novoNome.trim() });
    setNovoNome("");
    setNovaData("");
    await load();
  };

  const removeFeriado = async (data: string) => {
    await removeFeriadoMunicipal(data);
    await load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={ano}
          disabled={disabled}
          onChange={(e) => setAno(Number(e.target.value) || new Date().getFullYear())}
          className="w-24 bg-black/40"
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || loading} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Calendar className="mr-1 h-4 w-4" />}
          Carregar
        </Button>
      </div>

      <div className="max-h-60 space-y-1 overflow-y-auto">
        {feriados.map((f) => (
          <div key={`${f.data}-${f.nome}`} className="flex items-center justify-between rounded bg-white/5 p-2">
            <div>
              <span className="text-sm text-white">{f.nome}</span>
              <span className="ml-2 text-xs text-zinc-400">
                {f.data} · {f.tipo}
              </span>
            </div>
            {f.municipal ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                onClick={() => void removeFeriado(f.data)}
                className="text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            ) : null}
          </div>
        ))}
        {!loading && feriados.length === 0 ? (
          <p className="text-xs text-zinc-500">Nenhum feriado carregado para {ano}.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          type="date"
          value={novaData}
          disabled={disabled}
          onChange={(e) => setNovaData(e.target.value)}
          className="bg-black/40 md:w-40"
        />
        <Input
          value={novoNome}
          disabled={disabled}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder="Nome do feriado municipal"
          className="min-w-[180px] flex-1 bg-black/40"
        />
        <Button type="button" size="sm" disabled={disabled || !novaData || !novoNome.trim()} onClick={() => void addFeriado()}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}
