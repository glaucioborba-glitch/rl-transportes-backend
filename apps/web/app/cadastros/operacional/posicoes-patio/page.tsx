"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { ApiError } from "@/lib/api/staff-client";
import {
  deleteCadastroPosicaoPatio,
  listCadastrosPosicoesPatio,
  type CadastroPosicaoPatio,
} from "@/lib/api/cadastros-posicoes-patio-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

const STATUS_LABEL: Record<string, string> = {
  LIVRE: "Livre",
  OCUPADO: "Ocupado",
  RESERVADO: "Reservado",
  BLOQUEADO: "Bloqueado",
};

function statusClass(status: string) {
  if (status === "LIVRE") return "border-green-500/30 bg-green-500/15 text-green-400";
  if (status === "OCUPADO") return "border-amber-500/30 bg-amber-500/15 text-amber-400";
  if (status === "BLOQUEADO") return "border-red-500/30 bg-red-500/15 text-red-400";
  return "border-border text-muted-foreground";
}

export default function PosicoesPatioPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = { id: staffUser?.id, role: staffUser?.role ?? "", permissions: staffUser?.permissions };
  const [search, setSearch] = useState("");

  const { data, loading, error, refetch } = useWidgetData(() => listCadastrosPosicoesPatio(), []);
  const canCreate = canDo(user, "operacional", "CREATE");
  const canEdit = canDo(user, "operacional", "EDIT");
  const canDelete = canEdit || canDo(user, "operacional", "DELETE");

  const posicoes = useMemo(() => {
    const items = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.codigo.toLowerCase().includes(q) ||
        p.zonaNome.toLowerCase().includes(q) ||
        p.zonaCodigo.toLowerCase().includes(q) ||
        p.baiaCodigo.toLowerCase().includes(q),
    );
  }, [data?.items, search]);

  async function onExcluir(pos: CadastroPosicaoPatio) {
    if (!window.confirm(`Excluir a posição ${pos.codigo}?`)) return;
    try {
      await deleteCadastroPosicaoPatio(pos.id);
      toast.success("Posição excluída.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Posições de Pátio</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cada linha é um slot (zona, baia e número). A lista inicial é exemplo do sistema — edite
            ou exclua à vontade.
          </p>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={() => router.push("/cadastros/operacional/posicoes-patio/novo")}>
            <Plus className="mr-2 h-4 w-4" />
            Nova posição
          </Button>
        ) : null}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por código, zona ou baia..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? <LoadingSkeleton /> : null}
      {!loading && error ? (
        <WidgetError title="Não foi possível carregar posições de pátio" onRetry={refetch} />
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-4 text-left">Código</th>
                <th className="p-4 text-left">Zona</th>
                <th className="p-4 text-left">Baia</th>
                <th className="p-4 text-left">Slot</th>
                <th className="p-4 text-left">Tipo</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {posicoes.map((pos) => (
                <tr key={pos.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="p-4">
                    <span className="font-mono font-bold text-[var(--accent)]">{pos.codigo}</span>
                  </td>
                  <td className="p-4">
                    <p className="font-medium">{pos.zonaNome}</p>
                    <p className="text-xs text-muted-foreground">{pos.zonaCodigo}</p>
                  </td>
                  <td className="p-4 font-mono">{pos.baiaCodigo}</td>
                  <td className="p-4 tabular-nums">
                    {pos.slotNumero}
                    {pos.stackAltura > 1 ? (
                      <span className="text-xs text-muted-foreground"> · alt. {pos.stackAltura}</span>
                    ) : null}
                  </td>
                  <td className="p-4 text-muted-foreground">{pos.tipoAceito}</td>
                  <td className="p-4 text-center">
                    <Badge variant="neutral" className={statusClass(pos.status)}>
                      {STATUS_LABEL[pos.status] ?? pos.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-1">
                      {canEdit ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/cadastros/operacional/posicoes-patio/${pos.id}`)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Editar</span>
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => void onExcluir(pos)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Excluir</span>
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posicoes.length === 0 ? (
            <p className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Nenhuma posição neste filtro.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
