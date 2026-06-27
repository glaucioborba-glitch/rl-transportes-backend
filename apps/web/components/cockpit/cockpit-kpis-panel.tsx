"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApiError, staffJson } from "@/lib/api/staff-client";
import { cn } from "@/lib/utils";

type Periodo = "hoje" | "semana" | "mes";

type KpiDelta = { pct: number; direction: "up" | "down" | "flat" };

export type CockpitKpisData = {
  periodo: Periodo;
  tat: number;
  yardOccupancy: number;
  fleetEfficiency: number;
  revenuePerTeu: number;
  dailyRevenue: number;
  tatDelta: KpiDelta;
  yardDelta: KpiDelta;
  fleetDelta: KpiDelta;
  revenueDelta: KpiDelta;
  tatHistory: { hour: string; tat: number }[];
  revenueVsFleetCost: { label: string; receita: number; custoFrota: number }[];
  yardByContainerType: { tipo: string; quantidade: number; pct: number }[];
  geradoEm?: string;
};

const YARD_COLORS: Record<string, string> = {
  CHEIO: "#22c55e",
  VAZIO: "#64748b",
  REEFER: "#38bdf8",
};

function DeltaBadge({ delta, invert }: { delta: KpiDelta; invert?: boolean }) {
  if (delta.direction === "flat") {
    return <span className="text-xs text-slate-500">— vs período anterior</span>;
  }
  const good =
    invert === true
      ? delta.direction === "down"
      : delta.direction === "up"
        ? false
        : delta.direction === "down";
  const icon = delta.direction === "up" ? "↑" : "↓";
  return (
    <span className={cn("text-xs font-medium", good ? "text-emerald-400" : "text-amber-400")}>
      {icon} {Math.abs(delta.pct)}% vs anterior
    </span>
  );
}

function KpiCard({
  title,
  value,
  sub,
  delta,
  invertDelta,
  alert,
}: {
  title: string;
  value: string;
  sub?: string;
  delta?: KpiDelta;
  invertDelta?: boolean;
  alert?: boolean;
}) {
  return (
    <Card
      className={cn(
        "border-white/10 bg-[#0c1018]",
        alert ? "border-red-500/40 bg-red-500/5" : "border-emerald-500/15",
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-400">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className={cn("text-3xl font-bold tabular-nums", alert ? "text-red-300" : "text-white")}>
          {value}
        </p>
        {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
        {delta ? <DeltaBadge delta={delta} invert={invertDelta} /> : null}
      </CardContent>
    </Card>
  );
}

export function CockpitKpisPanel({ defaultPeriodo = "hoje" }: { defaultPeriodo?: Periodo }) {
  const [periodo, setPeriodo] = useState<Periodo>(defaultPeriodo);
  const [data, setData] = useState<CockpitKpisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Periodo) => {
    setLoading(true);
    setError(null);
    try {
      const r = await staffJson<CockpitKpisData>(`/dashboard/kpis?periodo=${p}`);
      setData(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erro ao carregar KPIs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(periodo);
  }, [load, periodo]);

  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="py-6 text-sm text-red-300">{error}</CardContent>
      </Card>
    );
  }

  if (loading || !data) {
    return <p className="text-slate-500">Carregando KPIs do cockpit…</p>;
  }

  const tatAlert = data.tat > 45;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["hoje", "Hoje"],
            ["semana", "Última semana"],
            ["mes", "Último mês"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={periodo === id ? "default" : "outline"}
            className={periodo === id ? "" : "border-zinc-600"}
            onClick={() => setPeriodo(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="TAT médio"
          value={`${data.tat.toFixed(1)} min`}
          sub="Gate In → Gate Out"
          delta={data.tatDelta}
          invertDelta
          alert={tatAlert}
        />
        <KpiCard
          title="Ocupação pátio"
          value={`${data.yardOccupancy}%`}
          sub="Posições ocupadas / capacidade"
          delta={data.yardDelta}
        />
        <KpiCard
          title="Frota ativa"
          value={`${data.fleetEfficiency}%`}
          sub="Motoristas FL em viagem"
          delta={data.fleetDelta}
        />
        <KpiCard
          title="Receita / TEU"
          value={`R$ ${data.revenuePerTeu.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          sub="20' = 1 TEU · 40' = 2 TEU"
          delta={data.revenueDelta}
        />
        <KpiCard
          title="Faturamento"
          value={`R$ ${data.dailyRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          sub={`Período: ${data.periodo}`}
          delta={data.revenueDelta}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-white/10 bg-[#0c1018]">
          <CardHeader>
            <CardTitle className="text-white">TAT por hora</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.tatHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} unit=" min" />
                <Tooltip
                  contentStyle={{ background: "#0c1018", border: "1px solid #ffffff20" }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Line type="monotone" dataKey="tat" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0c1018]">
          <CardHeader>
            <CardTitle className="text-white">Receita vs custo frota FL</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueVsFleetCost}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "#0c1018", border: "1px solid #ffffff20" }}
                  formatter={(v: number) =>
                    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  }
                />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="custoFrota" name="Custo frota" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-[#0c1018]">
        <CardHeader>
          <CardTitle className="text-white">Ocupação por tipo de contêiner (pátio atual)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.yardByContainerType.filter((x) => x.quantidade > 0)}
                  dataKey="quantidade"
                  nameKey="tipo"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ tipo, pct }) => `${tipo} ${pct}%`}
                >
                  {data.yardByContainerType.map((entry) => (
                    <Cell key={entry.tipo} fill={YARD_COLORS[entry.tipo] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0c1018", border: "1px solid #ffffff20" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {data.yardByContainerType.map((row) => (
              <div key={row.tipo}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-300">{row.tipo}</span>
                  <span className="tabular-nums text-slate-500">
                    {row.quantidade} ({row.pct}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${row.pct}%`,
                      backgroundColor: YARD_COLORS[row.tipo] ?? "#94a3b8",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
