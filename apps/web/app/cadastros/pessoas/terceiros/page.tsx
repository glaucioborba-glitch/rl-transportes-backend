"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit2, Plus, Search, Truck } from "lucide-react";
import { PessoasTabs } from "../components/pessoas-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import {
  labelPinosTerceiro,
  listCadastrosTerceiros,
} from "@/lib/api/cadastros-terceiros-client";
import { formatCPF, formatPhone } from "@/lib/cadastros/formatters";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

export default function TerceirosListPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = {
    id: staffUser?.id,
    role: staffUser?.role ?? "",
    permissions: staffUser?.permissions,
  };

  const [search, setSearch] = useState("");
  const { data, loading, error, refetch } = useWidgetData(
    () => listCadastrosTerceiros(search),
    [search],
  );

  const canCreate = canDo(user, "pessoas", "CREATE");
  const canEdit = canDo(user, "pessoas", "EDIT");
  const itens = useMemo(() => data?.items ?? [], [data?.items]);

  return (
    <div className="space-y-6">
      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/cadastros/pessoas" className="hover:text-white">
          Pessoas & Entidades
        </Link>
        <span>/</span>
        <span>Terceiros</span>
      </div>
      <PessoasTabs />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Terceiros</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pessoas físicas contratadas para transportes — motorista, dono e veículo
          </p>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={() => router.push("/cadastros/pessoas/terceiros/novo")}>
            <Plus className="mr-2 h-4 w-4" />
            Novo terceiro
          </Button>
        ) : null}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF, WhatsApp, placa ou PIX..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? <div className="h-64 animate-pulse rounded-lg border border-border bg-card" /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar terceiros" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4 text-left">Motorista</th>
                <th className="p-4 text-left">CPF</th>
                <th className="p-4 text-left">WhatsApp</th>
                <th className="p-4 text-left">Dono</th>
                <th className="p-4 text-left">PIX</th>
                <th className="p-4 text-left">Cavalo</th>
                <th className="p-4 text-left">Carreta</th>
                <th className="p-4 text-left">Capacidade</th>
                <th className="p-4 text-left">CNH</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((row) => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="p-4 font-medium">{row.motoristaNome}</td>
                  <td className="p-4 font-mono text-sm">{formatCPF(row.motoristaCpf)}</td>
                  <td className="p-4 text-sm tabular-nums">{formatPhone(row.whatsapp ?? "") || "—"}</td>
                  <td className="p-4 text-sm">{row.donoNome || "—"}</td>
                  <td className="p-4 max-w-[160px] truncate text-sm text-muted-foreground">{row.pix || "—"}</td>
                  <td className="p-4 font-mono text-sm">{row.placaCavalo}</td>
                  <td className="p-4 font-mono text-sm">
                    {(row.placasCarretas?.length
                      ? row.placasCarretas
                      : [row.placaCarreta, row.placaCarreta02].filter(Boolean)
                    ).join(" · ") || "—"}
                  </td>
                  <td className="p-4">
                    <Badge variant="neutral">
                      {row.carretas?.length
                        ? [...new Set(row.carretas.map((c) => labelPinosTerceiro(c)))].join(" · ")
                        : labelPinosTerceiro({ capacidade: row.capacidade, pinos: [] })}
                    </Badge>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {row.cnhCategoria || row.cnhValidade
                      ? `${row.cnhCategoria ?? "—"}${row.cnhValidade ? ` · ${row.cnhValidade}` : ""}`
                      : "—"}
                  </td>
                  <td className="p-4 text-center">
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/cadastros/pessoas/terceiros/${row.id}`)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {itens.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <Truck className="h-8 w-8 opacity-40" />
              Nenhum terceiro cadastrado.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
