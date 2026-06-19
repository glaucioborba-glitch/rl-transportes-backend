"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, staffGateCheckOut, staffGatePreCheckOut } from "@/lib/api/staff-client";
import { collectSolicitacaoContainerISOs } from "@/lib/container-display";
import { OperationPageHeader } from "@/components/shared/operation-identity";
import { toast } from "@/lib/toast";

export default function StaffGateCheckOutPage() {
  const { id: gateInId } = useParams<{ id: string }>();
  const router = useRouter();
  const [ctx, setCtx] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fotos, setFotos] = useState<File[]>([]);
  const [divTipo, setDivTipo] = useState("LACRE_DIVERGENTE");
  const [divAntes, setDivAntes] = useState("");
  const [divDepois, setDivDepois] = useState("");
  const [divManual, setDivManual] = useState<{ tipo: string; antes?: string; depois?: string }[]>([]);

  const load = useCallback(async () => {
    if (!gateInId) return;
    setLoading(true);
    try {
      setCtx(await staffGatePreCheckOut(gateInId));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao carregar check-out");
    } finally {
      setLoading(false);
    }
  }, [gateInId]);

  useEffect(() => {
    void load();
  }, [load]);

  const gateIn = ctx?.gateIn as Record<string, unknown> | undefined;
  const solicitacao = ctx?.solicitacao as Record<string, unknown> | undefined;
  const protocolo = solicitacao?.protocolo as string | undefined;

  async function onSubmit() {
    if (!gateInId) return;
    if (!fotos.length) {
      toast.error("Selecione fotos de saída");
      return;
    }
    setBusy(true);
    try {
      await staffGateCheckOut(
        gateInId,
        { divergenciasOperador: divManual.length ? divManual : undefined },
        fotos,
      );
      toast.success("Check-out finalizado");
      router.push("/staff/gate");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha no check-out");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !ctx) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <OperationPageHeader
        isos={collectSolicitacaoContainerISOs({
          containersSolicitacao: solicitacao?.containersSolicitacao as
            | Array<{ unidade?: string; ordem?: number }>
            | undefined,
        })}
        protocolo={protocolo}
        eyebrow={
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/80">Gate check-out</p>
        }
        actions={
          <Button variant="outline" className="border-zinc-600" asChild>
            <Link href="/staff/gate">Fila</Link>
          </Button>
        }
      />

      <Card className="border-white/10 bg-[#0b101c]/90">
        <CardHeader>
          <CardTitle className="text-lg text-white">Check-in de referência</CardTitle>
          <CardDescription className="text-zinc-500">
            Placas e divergências registradas na entrada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-300">
          <p>
            Cavalo:{" "}
            <span className="font-mono text-white">{gateIn ? String(gateIn.placaCavalo ?? "—") : "—"}</span>
          </p>
          <p className="text-xs text-zinc-500">
            Divergências: {gateIn ? JSON.stringify(gateIn.divergenciasJson ?? []) : "—"}
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-[#0b101c]/90">
        <CardHeader>
          <CardTitle className="text-lg text-white">Divergências de saída</CardTitle>
          <CardDescription className="text-zinc-500">Confirmação de lacre, avarias ou divergências finais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <Label className="text-zinc-400">Tipo</Label>
              <select
                value={divTipo}
                onChange={(e) => setDivTipo(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-600 bg-black/40 px-2 py-2 text-sm text-white"
              >
                <option value="LACRE_DIVERGENTE">Lacre divergente</option>
                <option value="CONTAINER_TROCADO">Container trocado</option>
                <option value="PLACA_DIVERGENTE">Placa divergente</option>
                <option value="OUTRA">Outra</option>
              </select>
            </div>
            <div>
              <Label className="text-zinc-400">Antes</Label>
              <Input value={divAntes} onChange={(e) => setDivAntes(e.target.value)} className="border-zinc-600 bg-black/40 text-white" />
            </div>
            <div>
              <Label className="text-zinc-400">Depois</Label>
              <Input value={divDepois} onChange={(e) => setDivDepois(e.target.value)} className="border-zinc-600 bg-black/40 text-white" />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-amber-600/50 text-amber-100"
            onClick={() => {
              setDivManual((prev) => [
                ...prev,
                { tipo: divTipo, antes: divAntes.trim() || undefined, depois: divDepois.trim() || undefined },
              ]);
              setDivAntes("");
              setDivDepois("");
            }}
          >
            Adicionar divergência
          </Button>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#0b101c]/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Upload className="h-5 w-5" />
            Fotos de saída
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="file"
            accept="image/*"
            multiple
            className="text-zinc-300"
            onChange={(e) => setFotos(Array.from(e.target.files ?? []))}
          />
        </CardContent>
      </Card>

      <Button
        type="button"
        className="bg-sky-600 text-white hover:bg-sky-500"
        disabled={busy}
        onClick={() => void onSubmit()}
      >
        {busy ? "…" : "Finalizar check-out"}
      </Button>
    </div>
  );
}
