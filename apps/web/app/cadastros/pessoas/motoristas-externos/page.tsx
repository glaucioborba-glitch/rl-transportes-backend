"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
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
import { ApiError } from "@/lib/api/staff-client";
import { formatCPF } from "@/lib/cadastros/formatters";
import {
  rotuloContagemBlacklist,
  type CatalogoMotoristaExterno,
} from "@/lib/catalogo-motorista-externo";
import { todayDateInputValue } from "@/lib/solicitacao-intent";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type PrazoBlacklist = "7" | "15" | "30" | "indefinido";

const PRAZOS: { id: PrazoBlacklist; label: string }[] = [
  { id: "7", label: "07 dias" },
  { id: "15", label: "15 dias" },
  { id: "30", label: "30 dias" },
  { id: "indefinido", label: "Indefinido" },
];

function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default function MotoristasExternosPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<"todos" | "livres" | "suspensos">("todos");
  const [page, setPage] = useState(1);
  const [alvo, setAlvo] = useState<CatalogoMotoristaExterno | null>(null);
  const [modo, setModo] = useState<"bloquear" | "liberar">("bloquear");
  const [prazo, setPrazo] = useState<PrazoBlacklist | null>(null);
  const [inicio, setInicio] = useState(todayDateInputValue);
  const [loginGestor, setLoginGestor] = useState("");
  const [senhaGestor, setSenhaGestor] = useState("");
  const [saving, setSaving] = useState(false);

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

  function fecharModal() {
    setAlvo(null);
    setPrazo(null);
    setInicio(todayDateInputValue());
    setLoginGestor("");
    setSenhaGestor("");
    setSaving(false);
  }

  function abrirBloqueio(m: CatalogoMotoristaExterno) {
    setModo("bloquear");
    setPrazo(null);
    setInicio(todayDateInputValue());
    setAlvo(m);
  }

  function abrirLiberacao(m: CatalogoMotoristaExterno) {
    setModo("liberar");
    setAlvo(m);
  }

  async function confirmar() {
    if (!alvo) return;
    if (!loginGestor.trim() || !senhaGestor.trim()) {
      toast.error("Informe login e senha gerencial.");
      return;
    }
    if (modo === "bloquear" && !prazo) {
      toast.error("Escolha o prazo do bloqueio.");
      return;
    }
    setSaving(true);
    try {
      if (modo === "liberar") {
        await liberarMotoristaExterno(alvo.id, {
          documento: loginGestor.trim(),
          password: senhaGestor,
        });
        toast.success("Black List cancelada. CPF liberado.");
      } else {
        await suspenderMotoristaExterno(alvo.id, {
          indefinido: prazo === "indefinido",
          dias: prazo && prazo !== "indefinido" ? Number(prazo) : undefined,
          inicio,
          motivo: "Black list operacional",
          documento: loginGestor.trim(),
          password: senhaGestor,
        });
        toast.success("Motorista incluído na Black List.");
      }
      fecharModal();
      await refetch();
    } catch (e) {
      toast.error(e instanceof ApiError || e instanceof Error ? e.message : "Não foi possível concluir.");
      setSaving(false);
    }
  }

  const podeConfirmar =
    Boolean(alvo && loginGestor.trim() && senhaGestor.trim()) &&
    (modo === "liberar" || Boolean(prazo)) &&
    !saving;

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
          CPF informados nas solicitações deste terminal. Autofill no portal e na intranet.
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
        {items.map((m) => {
          const bloqueado = m.suspenso;
          return (
            <div
              key={m.id}
              className={cn(
                "rounded-lg border bg-card p-4",
                bloqueado ? "border-red-500/50" : "border-border",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{m.nome}</p>
                    {bloqueado ? (
                      <span className="rounded-full border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-red-400">
                        Bloqueado
                        {rotuloContagemBlacklist(m) ? ` · ${rotuloContagemBlacklist(m)}` : null}
                      </span>
                    ) : null}
                  </div>
                  <p className="font-mono text-sm text-muted-foreground">{formatCPF(m.cpf)}</p>
                  {bloqueado ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Início {fmtData(m.suspensoEm)}
                      {m.indefinido ? "" : ` · até ${fmtData(m.suspensoAte)}`}
                    </p>
                  ) : null}
                </div>
                {bloqueado ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => abrirLiberacao(m)}>
                    Cancelar Black List
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => abrirBloqueio(m)}>
                    Black List
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {!loading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum motorista externo neste terminal ainda.</p>
        ) : null}
      </div>

      <PaginationSimple page={page} total={totalPages} onChange={setPage} />

      {alvo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-white/15 bg-[#0c0f14] p-5">
            <h2 className="text-lg font-semibold">
              {modo === "liberar" ? "Cancelar Black List" : "Black List"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {alvo.nome} · {formatCPF(alvo.cpf)}
            </p>

            {modo === "bloquear" ? (
              <>
                <label className="mt-4 mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Data de início
                </label>
                <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />

                <p className="mt-4 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Prazo do bloqueio
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PRAZOS.map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setPrazo(op.id)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                        prazo === op.id
                          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-orange-200"
                          : "border-white/15 bg-white/5 text-slate-200 hover:border-white/30",
                      )}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                O CPF volta a poder ser usado em baixa/coleta neste terminal.
              </p>
            )}

            <p className="mt-5 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Autorização gerencial
            </p>
            <label className="mb-1 block text-xs text-muted-foreground">Login (ADMIN / GERENTE)</label>
            <Input
              value={loginGestor}
              onChange={(e) => setLoginGestor(e.target.value)}
              placeholder="CPF do gestor"
              autoComplete="username"
            />
            <label className="mt-3 mb-1 block text-xs text-muted-foreground">Senha</label>
            <Input
              type="password"
              value={senhaGestor}
              onChange={(e) => setSenhaGestor(e.target.value)}
              placeholder="Senha administrativa"
              autoComplete="current-password"
            />

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={fecharModal} disabled={saving}>
                Fechar
              </Button>
              <Button type="button" disabled={!podeConfirmar} onClick={() => void confirmar()}>
                {saving ? "Aguarde…" : modo === "liberar" ? "Confirmar cancelamento" : "Confirmar bloqueio"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
