"use client";

import {
  AreaChart,
  BarList,
  Card,
  Metric,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Text,
  Title,
} from "@tremor/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BiCsvExportButton } from "@/components/bi/bi-csv-export-button";
import type { VisaoOperacionalResponse } from "@/lib/api/bi-analytics-types";

type Props = { data: VisaoOperacionalResponse };

export function VisaoOperacionalPanel({ data }: Props) {
  const projChart = data.ocupacaoProjetada.map((r) => ({
    dia: r.dia.slice(5),
    Estoque: r.estoqueAtual,
    Projetada: r.projetada,
    Entradas: r.entradas,
    Saídas: r.saidas,
  }));

  const heatByHour = Array.from({ length: 24 }, (_, h) => {
    const total = data.gateHeatmap.filter((x) => x.hora === h).reduce((s, x) => s + x.agendamentos, 0);
    return { hora: `${String(h).padStart(2, "0")}h`, agendamentos: total };
  }).filter((x) => x.agendamentos > 0);

  const frotaBar = data.frotaPatio.map((f) => ({ name: f.status, value: f.unidades }));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400/90">Visão Operacional</p>
        <h1 className="text-2xl font-semibold text-white">Projeções e gargalos</h1>
        <Text className="text-zinc-500">
          Sem dados financeiros · atualizado{" "}
          {data.atualizadoEm ? new Date(data.atualizadoEm).toLocaleString("pt-BR") : "—"}
        </Text>
      </header>

      {data.riscoEscala.length > 0 ? (
        <Card className="border-rose-500/40 bg-rose-950/25">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Title className="text-rose-100">Risco de escala — gargalos projetados</Title>
            <BiCsvExportButton
              filename="risco-escala"
              headers={["data", "turno", "cargo", "demanda", "capacidade", "deficit", "mensagem"]}
              rows={data.tabelas.riscoEscala.map((r) => [
                r.data,
                r.turno,
                r.cargo,
                r.demanda,
                r.capacidade,
                r.deficit,
                r.mensagem,
              ])}
            />
          </div>
          <ul className="space-y-2">
            {data.riscoEscala.map((a, i) => (
              <li
                key={`${a.data}-${a.turno}-${a.cargo}-${i}`}
                className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-100"
              >
                {a.mensagem}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="border-emerald-500/25 bg-emerald-950/15">
          <Title className="text-emerald-100">Risco de escala</Title>
          <Text className="mt-2 text-emerald-200/80">
            Nenhum gargalo projetado nos próximos 7 dias com a escala atual.
          </Text>
        </Card>
      )}

      <Card className="border-white/10 bg-[#0a0f14]/90">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Title className="text-zinc-200">Curva de ocupação projetada (7 dias)</Title>
          <BiCsvExportButton
            filename="ocupacao-projetada"
            headers={["dia", "estoque_atual", "entradas", "saidas", "projetada"]}
            rows={data.tabelas.ocupacao.map((r) => [r.dia, r.estoqueAtual, r.entradas, r.saidas, r.projetada])}
          />
        </div>
        <AreaChart
          className="h-72"
          data={projChart}
          index="dia"
          categories={["Estoque", "Projetada", "Entradas", "Saídas"]}
          colors={["slate", "cyan", "emerald", "rose"]}
          valueFormatter={(v) => `${v} un.`}
          showLegend
          curveType="monotone"
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-white/10 bg-[#0a0f14]/90">
          <div className="mb-3 flex items-center justify-between">
            <Title className="text-zinc-200">Heatmap Gate — picos por hora</Title>
            <BiCsvExportButton
              filename="gate-heatmap"
              headers={["dia_semana", "hora", "agendamentos"]}
              rows={data.tabelas.heatmap.map((r) => [r.diaSemana, r.hora, r.agendamentos])}
            />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={heatByHour.length ? heatByHour : [{ hora: "—", agendamentos: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="hora" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#0c1018", border: "1px solid #ffffff15", borderRadius: 8 }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Bar dataKey="agendamentos" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Text className="mt-2 text-xs text-zinc-500">
            Agregação dos últimos 30 dias · use para dimensionar checkers e empilhadeiras por turno.
          </Text>
        </Card>

        <Card className="border-white/10 bg-[#0a0f14]/90">
          <div className="mb-3 flex items-center justify-between">
            <Title className="text-zinc-200">Status frota / pátio</Title>
            <BiCsvExportButton
              filename="frota-patio"
              headers={["status", "unidades"]}
              rows={data.tabelas.frota.map((r) => [r.status, r.unidades])}
            />
          </div>
          <BarList data={frotaBar} color="cyan" className="mt-2" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            {data.frotaPatio.map((f) => (
              <div key={f.status} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <Text>{f.status}</Text>
                <Metric>{f.unidades}</Metric>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="border-white/10 bg-[#0a0f14]/90">
        <Title className="mb-3 text-zinc-200">Agendamentos por dia da semana × turno</Title>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Dia</TableHeaderCell>
              <TableHeaderCell>Hora ref.</TableHeaderCell>
              <TableHeaderCell>Agendamentos</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.gateHeatmap.slice(0, 12).map((h, i) => (
              <TableRow key={`${h.diaSemana}-${h.hora}-${i}`}>
                <TableCell>{h.diaLabel}</TableCell>
                <TableCell>{String(h.hora).padStart(2, "0")}:00</TableCell>
                <TableCell>{h.agendamentos}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
