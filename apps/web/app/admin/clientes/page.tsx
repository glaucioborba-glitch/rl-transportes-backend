"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type Row = {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  tipo: string;
  email: string;
};

export default function AdminClientesListaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const url = q.trim()
        ? `/clientes?page=1&limit=100&search=${encodeURIComponent(q.trim())}`
        : "/clientes?page=1&limit=100";
      const r = await staffJson<{ data: Row[] }>(url);
      setRows(r.data ?? []);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao listar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Clientes</h1>
          <p className="text-sm text-zinc-500">GET /clientes · edição fiscal NFS-e</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/executivo" className="text-sm text-zinc-400 hover:text-white">
            Voltar
          </Link>
          <Link href="/admin/clientes/novo" className={cn(buttonVariants({ size: "sm" }), "text-xs")}>
            Novo cliente
          </Link>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Buscar razão social, fantasia, e-mail ou documento…"
          className="border-zinc-700 bg-zinc-900 text-zinc-100"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load(search);
          }}
        />
        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
          onClick={() => void load(search)}
        >
          Buscar
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
        {loading ? (
          <p className="p-6 text-sm text-zinc-500">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">Nenhum cliente encontrado.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-100">{c.razaoSocial}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {c.tipo}
                    {c.nomeFantasia ? ` · ${c.nomeFantasia}` : ""} · {c.email}
                  </p>
                </div>
                <Link
                  href={`/admin/clientes/${c.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 text-xs")}
                >
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
