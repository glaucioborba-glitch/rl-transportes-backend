"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listSaasTiposContainer, type SaasTipoContainer } from "@/lib/api/super-admin-client";
import { formatTamanhoContainerDisplay, normalizeTamanhosContainer } from "@/lib/cadastros/tipo-container-tamanhos";

export default function SuperAdminTiposContainerPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<SaasTipoContainer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let on = true;
    setLoading(true);
    void listSaasTiposContainer(debounced)
      .then((r) => {
        if (!on) return;
        setItems(r.items);
        setTotal(r.total);
      })
      .catch(() => {
        if (!on) return;
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (on) setLoading(false);
      });
    return () => {
      on = false;
    };
  }, [debounced]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Tipos de contêiner</h2>
          <p className="text-sm text-zinc-400">
            Catálogo global. Todo terminal, o Gate e o portal do cliente leem daqui. DC/HC continua
            sendo capacidade, não tipo.
          </p>
        </div>
        <Button size="sm" onClick={() => router.push("/super-admin/tipos-container/novo")}>
          <Plus className="mr-2 h-4 w-4" />
          Novo tipo
        </Button>
      </div>
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar código ou nome…"
          className="pl-9"
        />
      </div>
      <p className="text-xs text-zinc-500">{loading ? "Carregando…" : `${total} tipo(s)`}</p>
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Nome</th>
              <th className="px-3 py-2 font-medium">Tamanhos</th>
              <th className="px-3 py-2 font-medium">Tomada</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((tipo) => (
              <tr
                key={tipo.id}
                className="cursor-pointer border-t border-white/10 hover:bg-white/5"
                onClick={() => router.push(`/super-admin/tipos-container/${tipo.id}`)}
              >
                <td className="px-3 py-2 font-mono text-white">{tipo.codigo}</td>
                <td className="px-3 py-2 text-zinc-300">{tipo.nome}</td>
                <td className="px-3 py-2 text-zinc-300">
                  {normalizeTamanhosContainer(tipo.tamanhos)
                    .map((t) => formatTamanhoContainerDisplay(t))
                    .join(" · ") || "—"}
                </td>
                <td className="px-3 py-2 text-zinc-300">
                  {tipo.tomadaReefer ? (
                    <span className="inline-flex items-center gap-1 text-blue-300">
                      <Snowflake className="h-3.5 w-3.5" />
                      Sim
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={tipo.ativo ? "text-emerald-400" : "text-zinc-500"}>
                    {tipo.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                  Nenhum tipo cadastrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
