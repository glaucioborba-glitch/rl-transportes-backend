"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Box,
  ChevronDown,
  ChevronRight,
  Grid3x3,
  Layers,
  MapPin,
  Plus,
} from "lucide-react";
import { OperacionalBreadcrumb, OperacionalTabs } from "../components/operacional-tabs";
import { PosicaoCard } from "./components/posicao-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWidgetData, WidgetError } from "@/components/ui/widget-error";
import { listCadastrosPosicoesPatio, type CadastroPosicaoPatio } from "@/lib/api/cadastros-posicoes-patio-client";
import { canDo } from "@/lib/cadastros/permission-matrix";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

function LoadingSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />;
}

type ZonaGroup = {
  id: string;
  codigo: string;
  nome: string;
  cor: string;
  baias: Array<{ id: string; codigo: string; slots: CadastroPosicaoPatio[] }>;
  totalSlots: number;
  ocupados: number;
};

function agruparPorZona(posicoes: CadastroPosicaoPatio[]): ZonaGroup[] {
  const zonasMap = new Map<string, ZonaGroup>();
  for (const pos of posicoes) {
    if (!zonasMap.has(pos.zonaId)) {
      zonasMap.set(pos.zonaId, {
        id: pos.zonaId,
        codigo: pos.zonaCodigo,
        nome: pos.zonaNome,
        cor: pos.zonaCor,
        baias: [],
        totalSlots: 0,
        ocupados: 0,
      });
    }
    const zona = zonasMap.get(pos.zonaId)!;
    zona.totalSlots++;
    if (pos.status === "OCUPADO") zona.ocupados++;
    let baia = zona.baias.find((b) => b.id === pos.baiaId);
    if (!baia) {
      baia = { id: pos.baiaId, codigo: pos.baiaCodigo, slots: [] };
      zona.baias.push(baia);
    }
    baia.slots.push(pos);
  }
  return Array.from(zonasMap.values());
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Building2;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <Icon className={`h-5 w-5 ${color}`} />
      <div>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function PosicoesPatioPage() {
  const router = useRouter();
  const staffUser = useStaffAuthStore((s) => s.user);
  const user = { id: staffUser?.id, role: staffUser?.role ?? "", permissions: staffUser?.permissions };
  const [expandedZonas, setExpandedZonas] = useState<Set<string>>(new Set());
  const [expandedBaias, setExpandedBaias] = useState<Set<string>>(new Set());

  const { data, loading, error, refetch } = useWidgetData(() => listCadastrosPosicoesPatio(), []);
  const canCreate = canDo(user, "operacional", "CREATE");
  const canEdit = canDo(user, "operacional", "EDIT");

  if (loading) return <LoadingSkeleton />;
  if (error) {
    return <WidgetError title="Não foi possível carregar posições de pátio" onRetry={refetch} />;
  }

  const posicoes = data?.items ?? [];
  const zonas = agruparPorZona(posicoes);

  return (
    <div className="space-y-6">
      <OperacionalBreadcrumb current="Posições de Pátio" />
      <OperacionalTabs />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Posições de Pátio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mapa digital · Zona → Baia → Slot → Stack
          </p>
        </div>
        {canCreate ? (
          <Button size="sm" onClick={() => router.push("/cadastros/operacional/posicoes-patio/novo")}>
            <Plus className="mr-2 h-4 w-4" /> Nova Posição
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={Building2} label="Zonas" value={zonas.length} color="text-blue-400" />
        <StatCard
          icon={Layers}
          label="Baias"
          value={zonas.reduce((acc, z) => acc + z.baias.length, 0)}
          color="text-purple-400"
        />
        <StatCard icon={Grid3x3} label="Slots" value={posicoes.length} color="text-amber-400" />
        <StatCard
          icon={Box}
          label="Ocupados"
          value={posicoes.filter((p) => p.status === "OCUPADO").length}
          color="text-red-400"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {zonas.length === 0 ? (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-3">
            <MapPin className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-lg text-muted-foreground">Nenhuma posição cadastrada.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {zonas.map((zona) => (
              <div key={zona.id} className="p-4">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedZonas((prev) => {
                      const next = new Set(prev);
                      if (next.has(zona.id)) next.delete(zona.id);
                      else next.add(zona.id);
                      return next;
                    })
                  }
                  className="flex w-full items-center gap-2 text-left"
                >
                  {expandedZonas.has(zona.id) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10">
                    <Building2 className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{zona.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {zona.baias.length} baia(s) · {zona.totalSlots} slot(s) · {zona.ocupados}{" "}
                      ocupado(s)
                    </p>
                  </div>
                  <Badge variant="neutral" style={{ color: zona.cor, borderColor: `${zona.cor}66` }}>
                    {zona.codigo}
                  </Badge>
                </button>

                {expandedZonas.has(zona.id) ? (
                  <div className="ml-6 mt-2 space-y-1 border-l border-border/50 pl-4">
                    {zona.baias.map((baia) => (
                      <div key={baia.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedBaias((prev) => {
                              const next = new Set(prev);
                              if (next.has(baia.id)) next.delete(baia.id);
                              else next.add(baia.id);
                              return next;
                            })
                          }
                          className="flex w-full items-center gap-2 py-2 text-left"
                        >
                          {expandedBaias.has(baia.id) ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <Layers className="h-4 w-4 text-purple-400" />
                          <span className="text-sm font-medium">{baia.codigo}</span>
                          <span className="text-xs text-muted-foreground">
                            · {baia.slots.length} slot(s)
                          </span>
                        </button>
                        {expandedBaias.has(baia.id) ? (
                          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                            {baia.slots.map((slot) => (
                              <PosicaoCard
                                key={slot.id}
                                posicao={slot}
                                canEdit={canEdit}
                                onEdit={() =>
                                  router.push(
                                    `/cadastros/operacional/posicoes-patio/${slot.id}`,
                                  )
                                }
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
