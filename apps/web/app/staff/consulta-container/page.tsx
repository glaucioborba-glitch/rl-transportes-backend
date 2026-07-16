"use client";

import { useCallback, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ContainerTimeline } from "@/components/container-timeline/container-timeline-ui";
import { ApiError, staffContainerRic, staffContainerTimeline } from "@/lib/api/staff-client";
import type { ContainerTimelineResponse } from "@/lib/container-timeline";
import { openRicPrintWindow } from "@/lib/ric-print";
import { toast } from "@/lib/toast";
import { ContainerNumber } from "@/components/ui/container-number";
import { formatContainerISO, stripContainerISO } from "@/utils/containerFormatter";

export default function ConsultaContainerPage() {
  const [isoInput, setIsoInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ContainerTimelineResponse | null>(null);
  const [ricBusy, setRicBusy] = useState<"ENTRADA" | "SAIDA" | null>(null);

  const buscar = useCallback(async () => {
    const raw = stripContainerISO(isoInput);
    if (raw.length < 4) {
      toast.error("Informe um número ISO válido.");
      return;
    }
    setLoading(true);
    try {
      setData(await staffContainerTimeline(isoInput));
    } catch (e) {
      setData(null);
      toast.error(e instanceof ApiError ? e.message : "Falha na consulta");
    } finally {
      setLoading(false);
    }
  }, [isoInput]);

  async function reimprimirRic(tipo: "ENTRADA" | "SAIDA") {
    if (!data) return;
    setRicBusy(tipo);
    try {
      const payload = await staffContainerRic(data.isoFormatado, tipo);
      openRicPrintWindow(payload);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Falha ao gerar RIC");
    } finally {
      setRicBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400/90">Operações</p>
        <h1 className="text-2xl font-semibold text-white">Consulta Container — Dossiê 360º</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-400">
          Event sourcing do ciclo de vida do equipamento (ISO 6346). API:{" "}
          <code className="text-cyan-200/90">GET /admin/container/:iso/timeline</code>
        </p>
      </div>

      <Card className="border-white/10 bg-[#0b101c]/80">
        <CardHeader>
          <CardTitle className="text-lg text-white">Buscar contêiner</CardTitle>
          <CardDescription className="text-zinc-500">
            Padrão ISO: 4 letras + 6 dígitos + verificador (ex.: GLDU 944333-5)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={isoInput}
            onChange={(e) => setIsoInput(formatContainerISO(e.target.value))}
            placeholder="GLDU 944333-5"
            className="border-zinc-600 bg-black/40 font-mono text-white"
            onKeyDown={(e) => {
              if (e.key === "Enter") void buscar();
            }}
          />
          <Button type="button" className="gap-2 bg-cyan-700 hover:bg-cyan-600" disabled={loading} onClick={() => void buscar()}>
            <Search className="h-4 w-4" />
            {loading ? "Consultando…" : "Consultar"}
          </Button>
        </CardContent>
      </Card>

      {data?.bloqueios?.length ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-100">Bloqueios / retenções</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-50/90">
            {data.bloqueios.map((b, i) => (
              <p key={`${b.tipo}-${i}`}>
                <strong>{b.origem}</strong> ({b.tipo}): {b.motivo}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <Card className="border-white/10 bg-[#0b101c]/80">
          <CardHeader>
            <ContainerNumber value={data.isoFormatado} size="lg" showLabel={false} />
            <CardDescription className="text-zinc-500">
              {data.eventos.length} evento(s) · gerado {new Date(data.geradoEm).toLocaleString("pt-BR")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContainerTimeline
              eventos={data.eventos}
              showAdminMeta
              onReprintRic={(t) => void reimprimirRic(t)}
              ricBusy={ricBusy}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
