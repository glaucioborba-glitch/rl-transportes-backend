"use client";

import Link from "next/link";
import { useState } from "react";
import { FileDown, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, handleStaffUnauthorized, staffGateDownloadPdf } from "@/lib/api/staff-client";
import type { GateDespachoItem } from "@/lib/gate/gate-cockpit-types";
import { formatChegada } from "@/lib/gate/gate-cockpit-utils";
import { ContainerNumber } from "@/components/ui/container-number";
import { ProtocolRefLabel } from "@/components/shared/operation-identity";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";

type Props = {
  items: GateDespachoItem[];
};

export function GateDespachoPanel({ items }: Props) {
  const [generatingPdf, setGeneratingPdf] = useState<Record<string, boolean>>({});

  async function gerarPdf(solicitacaoId: string) {
    setGeneratingPdf((prev) => ({ ...prev, [solicitacaoId]: true }));
    try {
      await staffGateDownloadPdf(solicitacaoId);
      toast.success("PDF gerado com sucesso!");
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      if (handleStaffUnauthorized(status)) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }
      console.error("Erro ao gerar PDF:", e);
      toast.error(
        e instanceof ApiError ? e.message : "Falha ao gerar PDF. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setGeneratingPdf((prev) => ({ ...prev, [solicitacaoId]: false }));
    }
  }

  if (!items.length) {
    return (
      <p className="py-12 text-center text-sm text-zinc-500">
        Nenhum caminhão pronto para despacho (aguardando gate-out).
      </p>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
      {items.map((row) => (
        <Card key={row.id} className="border-white/10 bg-[#0b1018]/90">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base text-white">
                <ContainerNumber value={row.containersIso[0] ?? "—"} />
                <ProtocolRefLabel protocolo={row.protocolo} className="mt-1" />
              </CardTitle>
              <Badge variant="neutral" className="border-violet-500/40 bg-violet-500/15 text-violet-100">
                Pronto despacho
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
              <div className="col-span-2">
                <dt className="text-[10px] uppercase tracking-wide">Pronto desde</dt>
                <dd>{formatChegada(row.prontoDesde)}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-zinc-600 text-xs"
                disabled={!!generatingPdf[row.id]}
                onClick={() => void gerarPdf(row.id)}
              >
                {generatingPdf[row.id] ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-1.5 h-3.5 w-3.5" />
                    Gerar PDF
                  </>
                )}
              </Button>
              {row.gateInId ? (
                <Button size="sm" className="bg-violet-700 hover:bg-violet-600" asChild>
                  <Link href={`/staff/gate/checkout/${row.gateInId}`}>
                    <LogOut className="mr-1.5 h-4 w-4" />
                    Liberar saída
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
