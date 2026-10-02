"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { solicitacaoContainerPrimary } from "@/lib/container-display";
import { ContainerPrimaryHeading, ProtocolRefTag } from "@/components/shared/operation-identity";
import { formatContainerISO } from "@/utils/containerFormatter";

type Unidade = { id?: string; numeroIso?: string; tipo?: string };

export function GateCard({
  row,
}: {
  row: {
    id: string;
    protocolo?: string;
    status?: string;
    cliente?: { razaoSocial?: string };
    unidades?: Unidade[];
    containersSolicitacao?: Array<{ unidade?: string; ordem?: number }>;
    portaria?: unknown;
    gate?: unknown;
    patio?: unknown;
    saida?: unknown;
  } | null;
}) {
  if (!row) {
    return (
      <Card className="border-white/10 bg-[#0c0f14]">
        <CardHeader>
          <CardTitle className="text-slate-400">Nenhuma solicitação</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const display = solicitacaoContainerPrimary(row);

  return (
    <Card className="border-white/10 bg-[#0c0f14]">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <ContainerPrimaryHeading display={display} size="lg" />
          <div className="flex flex-wrap items-center gap-2">
            {row.protocolo ? <ProtocolRefTag protocolo={row.protocolo} /> : null}
            <Badge variant="neutral" className="font-normal normal-case">
              {row.status}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-slate-400">Cliente · {row.cliente?.razaoSocial ?? "—"}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-slate-500">Unidades</p>
        <ul className="space-y-1">
          {(row.unidades ?? []).map((u) => (
            <li key={u.id ?? u.numeroIso} className="flex justify-between rounded-lg bg-black/30 px-3 py-2 font-mono text-white">
              <span>{formatContainerISO(u.numeroIso ?? "") || u.numeroIso}</span>
              <span className="text-slate-500">{u.tipo}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
          <span>Portaria: {row.portaria ? "sim" : "não"}</span>
          <span>Gate: {row.gate ? "sim" : "não"}</span>
          <span>Pátio: {row.patio ? "sim" : "não"}</span>
          <span>Saída: {row.saida ? "sim" : "não"}</span>
        </div>
      </CardContent>
    </Card>
  );
}
