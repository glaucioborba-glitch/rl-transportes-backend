"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  staffPatioHistoricoIso,
  staffPatioInventario,
  staffPatioMovimentar,
  type StaffPatioInventario,
} from "@/lib/api/staff-client";
import { cn } from "@/lib/utils";
import { GiroEstimadoBadge } from "@/components/staff/giro-estimado-badge";
import { toast } from "@/lib/toast";

const BAIA_COR: Record<string, string> = {
  verde: "border-emerald-500/50 bg-emerald-950/30",
  amarelo: "border-amber-500/50 bg-amber-950/25",
  vermelho: "border-rose-500/50 bg-rose-950/30",
};

const STATUS_COR: Record<string, string> = {
  ESTOCADO: "bg-sky-500/25 text-sky-100 border-sky-500/40",
  MOVIMENTANDO: "bg-orange-500/25 text-orange-100 border-orange-500/40",
  SEPARADO: "bg-violet-500/25 text-violet-100 border-violet-500/40",
  AGUARDANDO_GATE_OUT: "bg-zinc-500/30 text-zinc-200 border-zinc-500/40",
};

export default function StaffPatioPage() {
  const [inv, setInv] = useState<StaffPatioInventario | null>(null);
  const [loading, setLoading] = useState(true);
  const [isoBusca, setIsoBusca] = useState("");
  const [destinoBaia, setDestinoBaia] = useState("");
  const [selUnidade, setSelUnidade] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInv(await staffPatioInventario());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao carregar pátio");
      setInv(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onBuscarIso() {
    const iso = isoBusca.trim();
    if (!iso) return;
    setBusy(true);
    try {
      const h = await staffPatioHistoricoIso(iso);
      toast.success(`Histórico carregado — ${String((h.registros as unknown[])?.length ?? 0)} registro(s)`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Unidade não encontrada");
    } finally {
      setBusy(false);
    }
  }

  async function onMoverShift() {
    if (!selUnidade || !destinoBaia.trim()) {
      toast.error("Selecione unidade e baia destino");
      return;
    }
    setBusy(true);
    try {
      await staffPatioMovimentar({
        unidadeId: selUnidade,
        codigoBaiaDestino: destinoBaia.trim().toUpperCase(),
        tipo: "SHIFT",
      });
      toast.success("Movimentação registrada");
      setSelUnidade(null);
      setDestinoBaia("");
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha na movimentação");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">Yard Management</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Pátio v2 — inventário e movimentações</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Posicionamento por baia, lift on/off, divergências e integração Gate In/Out.
          </p>
        </div>
        <Button type="button" variant="outline" className="border-zinc-600" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {loading && !inv ? (
        <Skeleton className="h-64 w-full" />
      ) : inv ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-white/10 bg-[#0b101c]/90">
              <CardHeader className="pb-2">
                <CardDescription className="text-zinc-500">Lotação</CardDescription>
                <CardTitle className="text-2xl text-white">
                  {inv.lotacaoTotal}/{inv.capacidadeTotal}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-white/10 bg-[#0b101c]/90">
              <CardHeader className="pb-2">
                <CardDescription className="text-zinc-500">Reefers</CardDescription>
                <CardTitle className="text-2xl text-cyan-200">{inv.reefersLigados}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-white/10 bg-[#0b101c]/90">
              <CardHeader className="pb-2">
                <CardDescription className="text-zinc-500">Média armazenagem (h)</CardDescription>
                <CardTitle className="text-2xl text-white">{inv.mediaHorasArmazenado ?? "—"}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-white/10 bg-[#0b101c]/90">
              <CardHeader className="pb-2">
                <CardDescription className="text-zinc-500">Divergências</CardDescription>
                <CardTitle className="text-2xl text-amber-200">{inv.divergencias.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-white/10 bg-[#0b101c]/90">
            <CardHeader>
              <CardTitle className="text-lg text-white">Busca ISO / movimentação</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <div className="flex min-w-[200px] flex-1 gap-2">
                <Input
                  placeholder="ISO container"
                  value={isoBusca}
                  onChange={(e) => setIsoBusca(e.target.value.toUpperCase())}
                  className="border-zinc-600 bg-black/40 font-mono text-white"
                />
                <Button type="button" variant="outline" disabled={busy} onClick={() => void onBuscarIso()}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <Label className="text-xs text-zinc-500">Baia destino (shift)</Label>
                  <Input
                    value={destinoBaia}
                    onChange={(e) => setDestinoBaia(e.target.value.toUpperCase())}
                    className="mt-1 w-24 border-zinc-600 bg-black/40 font-mono text-white"
                    placeholder="A01"
                  />
                </div>
                <Button type="button" className="bg-emerald-700 hover:bg-emerald-600" disabled={busy || !selUnidade} onClick={() => void onMoverShift()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mover (SHIFT)"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {inv.divergencias.length > 0 ? (
            <Card className="border-amber-500/30 bg-amber-950/20">
              <CardHeader>
                <CardTitle className="text-amber-100">Divergências — sem posição</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-amber-100/90">
                {inv.divergencias.map((d) => (
                  <p key={d.unidadeId}>
                    {d.unidadeIso} · {d.status} — {d.motivo}
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {inv.baias.map((b) => (
              <Card
                key={b.id}
                className={cn("border-2", BAIA_COR[b.cor] ?? BAIA_COR.verde)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-mono text-xl text-white">{b.codigoBaia}</CardTitle>
                    <Badge variant="neutral" className="border-white/20 text-zinc-300">
                      {b.ocupacao}/{b.capacidade}
                    </Badge>
                  </div>
                  <CardDescription className="text-zinc-400">{b.ratio}% ocupação</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {b.unidades.length ? (
                    b.unidades.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelUnidade(u.id)}
                        className={cn(
                          "w-full rounded border px-2 py-2 text-left text-xs transition",
                          selUnidade === u.id ? "border-emerald-400 bg-emerald-950/50" : "border-white/10 bg-black/30 hover:bg-white/5",
                        )}
                      >
                        <p className="font-mono text-emerald-100">
                          {u.unidadeIso}
                          <GiroEstimadoBadge giro={u.giroEstimado} className="ml-1.5 align-middle" />
                        </p>
                        <p className="text-zinc-500">{u.protocolo} · {u.cliente}</p>
                        <Badge className={cn("mt-1 text-[10px]", STATUS_COR[u.status] ?? STATUS_COR.ESTOCADO)}>
                          {u.status}
                          {u.refrigerado ? " · reefer" : ""}
                        </Badge>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-500">Baia vazia</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
