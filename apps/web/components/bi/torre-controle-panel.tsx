"use client";

import {
  AreaChart,
  Card,
  DonutChart,
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
import { BiCsvExportButton } from "@/components/bi/bi-csv-export-button";
import type { TorreControleResponse } from "@/lib/api/bi-analytics-types";
import { cn } from "@/lib/utils";

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function tatColor(minutos: number, verde: number, vermelho: number) {
  if (minutos <= verde) return "text-emerald-400";
  if (minutos >= vermelho) return "text-red-400";
  return "text-amber-400";
}

type Props = { data: TorreControleResponse };

export function TorreControlePanel({ data }: Props) {
  const receitaChart = data.financeiro.receitaSerie.slice(-60).map((r) => ({
    dia: r.dia.slice(5),
    Provisionada: r.provisionada,
    Faturada: r.faturada,
  }));

  const tatChart = data.operacional.tatSerie.map((r) => ({
    dia: r.dia.slice(5),
    "TAT (min)": r.minutos,
  }));

  const patioDonut = [
    { name: "Ocupadas", value: data.operacional.patio.ocupadas },
    { name: "Livres", value: data.operacional.patio.livres },
  ];

  const tat = data.operacional.tatMedioMinutos;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-400/90">ADMIN · Torre de Controle</p>
        <h1 className="text-2xl font-semibold text-white">Visão 360º</h1>
        <Text className="text-zinc-500">
          Financeiro + operação · atualizado{" "}
          {data.atualizadoEm ? new Date(data.atualizadoEm).toLocaleString("pt-BR") : "—"}
        </Text>
      </header>

      <section className="space-y-4">
        <Title className="text-zinc-300">Financeiro</Title>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-white/10 bg-[#0a0f14]/90">
            <Text>DSO (dias)</Text>
            <Metric>{data.financeiro.dsoDias.toFixed(1)}</Metric>
          </Card>
          <Card className="border-white/10 bg-[#0a0f14]/90">
            <Text>Faturas em aberto</Text>
            <Metric>{data.financeiro.faturasAbertasQtd}</Metric>
          </Card>
          <Card className="border-white/10 bg-[#0a0f14]/90">
            <Text>Valor em aberto</Text>
            <Metric>{brl(data.financeiro.faturasAbertasValor)}</Metric>
          </Card>
        </div>

        <Card className="border-white/10 bg-[#0a0f14]/90">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Title className="text-zinc-200">Receita provisionada vs. faturada</Title>
            <BiCsvExportButton
              filename="faturamento-diario"
              headers={["dia", "provisionada", "faturada"]}
              rows={data.tabelas.faturamentoDiario.map((r) => [r.dia, r.provisionada, r.faturada])}
            />
          </div>
          <AreaChart
            className="h-72"
            data={receitaChart}
            index="dia"
            categories={["Provisionada", "Faturada"]}
            colors={["violet", "emerald"]}
            valueFormatter={(v) => brl(Number(v))}
            showLegend
            curveType="monotone"
          />
        </Card>
      </section>

      <section className="space-y-4">
        <Title className="text-zinc-300">Operacional</Title>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-white/10 bg-[#0a0f14]/90 lg:col-span-1">
            <Text>TAT médio (Gate-In → Gate-Out)</Text>
            <Metric className={cn(tatColor(tat, data.operacional.tatMetaVerde, data.operacional.tatMetaVermelho))}>
              {tat.toFixed(1)} min
            </Metric>
            <Text className="mt-2 text-xs">
              Meta: &lt; {data.operacional.tatMetaVerde} min (verde) · &gt; {data.operacional.tatMetaVermelho} min (vermelho)
            </Text>
          </Card>

          <Card className="border-white/10 bg-[#0a0f14]/90 lg:col-span-2">
            <Title className="mb-2 text-zinc-200">TAT diário</Title>
            <AreaChart
              className="h-52"
              data={tatChart}
              index="dia"
              categories={["TAT (min)"]}
              colors={["cyan"]}
              valueFormatter={(v) => `${Number(v).toFixed(0)} min`}
              curveType="monotone"
            />
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-white/10 bg-[#0a0f14]/90">
            <Title className="mb-2 text-zinc-200">Ocupação de pátio</Title>
            <DonutChart
              className="mx-auto h-52"
              data={patioDonut}
              category="value"
              index="name"
              colors={["rose", "slate"]}
              valueFormatter={(v) => `${v} pos.`}
              showLabel
            />
            <Text className="mt-2 text-center text-zinc-400">
              {data.operacional.patio.ocupacaoPercent}% ocupado · {data.operacional.patio.ocupadas} /{" "}
              {data.operacional.patio.capacidadeTotal} posições
            </Text>
          </Card>

          <Card className="border-white/10 bg-[#0a0f14]/90">
            <div className="mb-3 flex items-center justify-between">
              <Title className="text-zinc-200">Detalhe TAT (30 dias)</Title>
              <BiCsvExportButton
                filename="tat-gate"
                headers={["dia", "ciclos", "tat_medio_minutos"]}
                rows={data.tabelas.tatDetalhe.map((r) => [r.dia, r.ciclos, r.tatMedioMinutos])}
              />
            </div>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Dia</TableHeaderCell>
                  <TableHeaderCell>Ciclos</TableHeaderCell>
                  <TableHeaderCell>TAT (min)</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.tabelas.tatDetalhe.slice(0, 8).map((r) => (
                  <TableRow key={r.dia}>
                    <TableCell>{r.dia}</TableCell>
                    <TableCell>{r.ciclos}</TableCell>
                    <TableCell className={tatColor(r.tatMedioMinutos, 30, 45)}>{r.tatMedioMinutos.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </section>
    </div>
  );
}
