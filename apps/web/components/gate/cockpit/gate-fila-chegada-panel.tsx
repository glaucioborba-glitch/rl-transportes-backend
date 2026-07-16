"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ApiError,
  staffGateDirecionarOperacao,
  staffGateRetornarEntrada,
} from "@/lib/api/staff-client";
import type { GateFilaChegadaItem } from "@/lib/gate/gate-cockpit-types";
import { formatChegada } from "@/lib/gate/gate-cockpit-utils";
import { podeOperarGate } from "@/lib/gate/gate-cockpit-permissions";
import { ContainerNumber } from "@/components/ui/container-number";
import { ProtocolRefLabel } from "@/components/shared/operation-identity";
import { useStaffAuthStore } from "@/stores/staff-auth-store";
import { toast } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Props = {
  items: GateFilaChegadaItem[];
  onAction: () => void;
};

export function GateFilaChegadaPanel({ items, onAction }: Props) {
  const user = useStaffAuthStore((s) => s.user);
  const podeOperar = podeOperarGate(user);
  const [retornarId, setRetornarId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  async function direcionar(id: string) {
    setBusy(true);
    try {
      await staffGateDirecionarOperacao(id);
      toast.success("Caminhão direcionado para operação");
      onAction();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao direcionar");
    } finally {
      setBusy(false);
    }
  }

  async function retornar() {
    if (!retornarId || !motivo.trim()) return;
    setBusy(true);
    try {
      await staffGateRetornarEntrada(retornarId, motivo.trim());
      toast.success("Caminhão retornado — entrada negada");
      setRetornarId(null);
      setMotivo("");
      onAction();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao retornar");
    } finally {
      setBusy(false);
    }
  }

  if (!items.length) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        Nenhum caminhão na fila de chegada (portaria liberada, aguardando gate).
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
        {items.map((row) => {
          const fotos = [
            ...row.fotosPortaria.caminhao,
            ...row.fotosPortaria.container,
            ...row.fotosPortaria.documento,
          ];
          return (
            <Card key={row.id} className="border-white/10 bg-[#0b1018]/90">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base text-white">
                    <ContainerNumber value={row.containersIso[0] ?? "—"} />
                    <ProtocolRefLabel protocolo={row.protocolo} className="mt-1" />
                  </CardTitle>
                  <Badge variant="neutral" className="shrink-0 border-amber-500/40 bg-amber-500/15 text-amber-100">
                    Chegou portaria
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-400">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide">Placa</dt>
                    <dd className="font-mono text-white">{row.placa ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide">Motorista</dt>
                    <dd className="text-zinc-200">{row.motorista ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide">Tipo</dt>
                    <dd>{row.tipoCaminhao}{row.tipoContainer ? ` · ${row.tipoContainer}` : ""}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide">Chegada</dt>
                    <dd>{formatChegada(row.chegadaEm)}</dd>
                  </div>
                </dl>

                {fotos.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {fotos.slice(0, 4).map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={`${row.id}-f-${i}`}
                        src={url}
                        alt="Foto portaria"
                        className="h-14 w-14 rounded border border-white/10 object-cover"
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600">Sem fotos da portaria</p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {podeOperar ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-700 hover:bg-emerald-600"
                        disabled={busy}
                        onClick={() => void direcionar(row.id)}
                      >
                        <Truck className="mr-1.5 h-4 w-4" />
                        Direcionar empilhadeira
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-rose-600/50 text-rose-100"
                        disabled={busy}
                        onClick={() => setRetornarId(row.id)}
                      >
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        Retornar
                      </Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="outline" className="border-zinc-600" asChild>
                    <Link href={`/staff/gate/checkin/${row.id}`}>Check-in completo</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!retornarId} onOpenChange={(o) => !o && setRetornarId(null)}>
        <DialogContent className="border-white/10 bg-[#0c1018] text-white">
          <DialogHeader>
            <DialogTitle>Retornar caminhão</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-retorno">Motivo da entrada negada</Label>
            <Input
              id="motivo-retorno"
              className="border-white/15 bg-black/40"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRetornarId(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-rose-700 hover:bg-rose-600"
              disabled={busy || !motivo.trim()}
              onClick={() => void retornar()}
            >
              Confirmar retorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
