"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Search, Unlock } from "lucide-react";
import { PessoasTabs } from "../components/pessoas-tabs";
import { PaginationSimple } from "@/components/cadastros/pagination-simple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import {
  liberarMotoristaExterno,
  listMotoristasExternos,
  suspenderMotoristaExterno,
} from "@/lib/api/cadastros-motoristas-externos-client";
import { formatCPF } from "@/lib/cadastros/formatters";
import { isIntranetGestorRole } from "@/lib/intranet/intranet-path-access";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import type { CatalogoMotoristaExterno } from "@/lib/catalogo-motorista-externo";

export default function MotoristasExternosPage() {
  const staffUser = useStaffAuthStore((s) => s.user);
  const canSuspender = isIntranetGestorRole(staffUser?.role);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<"todos" | "livres" | "suspensos">("todos");
  const [page, setPage] = useState(1);
  const [alvo, setAlvo] = useState<CatalogoMotoristaExterno | null>(null);
  const [dias, setDias] = useState("7");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const { data, loading, error, refetch } = useWidgetData(
    () => listMotoristasExternos({ search: debouncedSearch, status, page }),
    [debouncedSearch, status, page],
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function confirmarSuspensao() {
    if (!alvo) return;
    setSalvando(true);
    try {
      await suspenderMotoristaExterno(alvo.id, Number(dias), motivo);
      toast.success("Motorista suspenso neste terminal.");
      setAlvo(null);
      setMotivo("");
      setDias("7");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível suspender.");
    } finally {
      setSalvando(false);
    }
  }

  async function liberar(id: string) {
    setSalvando(true);
    try {
      await liberarMotoristaExterno(id);
      toast.success("Suspensão encerrada.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível liberar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/cadastros/pessoas" className="hover:text-white">
            Pessoas & Entidades
          </Link>
          <span>/</span>
          <span>Motoristas externos</span>
        </div>
        <h1 className="text-2xl font-bold">Motoristas externos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CPF informados nas solicitações deste terminal. Autofill no portal e na intranet. Suspensão
          vale só aqui.
        </p>
      </div>

      <PessoasTabs />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou CPF"
            className="pl-9"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="todos">Todos</option>
          <option value="livres">Livres</option>
          <option value="suspensos">Suspensos</option>
        </select>
      </div>

      {error ? (
        <WidgetError title="Não foi possível carregar" message={error.message} onRetry={refetch} />
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}

      <div className="space-y-3">
        {items.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border bg-card p-4 ${
              m.suspenso ? "border-red-500/40" : "border-border"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{m.nome}</p>
                <p className="font-mono text-sm text-muted-foreground">{formatCPF(m.cpf)}</p>
                {m.suspenso ? (
                  <p className="mt-1 text-sm text-red-400">
                    Suspenso até{" "}
                    {m.suspensoAte ? new Date(m.suspensoAte).toLocaleDateString("pt-BR") : "—"}
                    {m.suspensaoMotivo ? ` · ${m.suspensaoMotivo}` : ""}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Origem: {m.origem}</p>
                )}
              </div>
              {canSuspender ? (
                <div className="flex gap-2">
                  {m.suspenso ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={salvando}
                      onClick={() => void liberar(m.id)}
                    >
                      <Unlock className="mr-1 h-4 w-4" />
                      Liberar
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => setAlvo(m)}>
                      <Ban className="mr-1 h-4 w-4" />
                      Suspender
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {!loading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum motorista externo neste terminal ainda. Eles entram quando o cliente ou o gate
            abre uma solicitação com CPF.
          </p>
        ) : null}
      </div>

      <PaginationSimple page={page} total={totalPages} onChange={setPage} />

      {alvo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Suspender {alvo.nome}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O CPF {formatCPF(alvo.cpf)} não poderá abrir solicitação neste terminal até o fim do
              prazo.
            </p>
            <label className="mt-4 mb-1 block text-xs text-muted-foreground">Dias</label>
            <Input
              type="number"
              min={1}
              max={365}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
            />
            <label className="mt-3 mb-1 block text-xs text-muted-foreground">Motivo</label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: desrespeito à regra de velocidade no pátio"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAlvo(null)}>
                Cancelar
              </Button>
              <Button type="button" disabled={salvando} onClick={() => void confirmarSuspensao()}>
                Confirmar suspensão
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
