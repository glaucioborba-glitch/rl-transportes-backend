"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { OperationalTimeline } from "@/components/operador/operational-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/skeleton";

function stripPhotos(raw: unknown, key: string): string[] {
  const p = raw && typeof raw === "object" ? (raw as Record<string, unknown>)[key] : null;
  return Array.isArray(p) ? p.filter((x): x is string => typeof x === "string") : [];
}

export default function PatioDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        setRow(await staffJson(`/solicitacoes/${id}`));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Erro");
        setRow(null);
      }
    })();
  }, [id]);

  if (!row) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const portaria = row.portaria as Record<string, unknown> | null | undefined;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-xl text-white">{String(row.protocolo)}</h1>
        <Button variant="outline" asChild>
          <Link href="/operador/patio">Voltar</Link>
        </Button>
      </div>

      <Card className="border-white/10 bg-[#0c0f14]">
        <CardHeader>
          <CardTitle className="text-white">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <OperationalTimeline
            active={row.patio ? "saida" : row.gate ? "patio" : row.portaria ? "gate" : "portaria"}
            portariaDone={!!row.portaria}
            gateDone={!!row.gate}
            patioDone={!!row.patio}
            saidaDone={!!row.saida}
          />
        </CardContent>
      </Card>

      {portaria ? (
        <Card className="border-white/10 bg-[#0c0f14]">
          <CardHeader>
            <CardTitle className="text-white">Evidências (portaria)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ["caminhão", "fotosCaminhao"],
              ["contêiner", "fotosContainer"],
              ["lacre", "fotosLacre"],
              ["avarias", "fotosAvarias"],
            ].map(([label, key]) => {
              const urls = stripPhotos(portaria, key);
              if (!urls.length) return null;
              return (
                <div key={key}>
                  <p className="mb-2 text-sm text-slate-400">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {urls.slice(0, 12).map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={src} src={src} alt="" className="h-24 w-32 rounded-lg border border-white/10 object-cover" />
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
