"use client";

import { CockpitKpisPanel } from "@/components/cockpit/cockpit-kpis-panel";

/** Dashboard executivo BI logístico — intranet operador (spec PR Cockpit Executivo). */
export default function OperadorDashboardPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">
          BI Logístico
        </p>
        <h1 className="text-2xl font-semibold text-white">Cockpit Executivo</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-400">
          KPIs consolidados de Gate, Pátio, Faturamento e Frota — TAT, TEU, ocupação e eficiência
          operacional. Dados via <code className="text-emerald-200/90">GET /dashboard/kpis</code> (cache
          5 min).
        </p>
      </div>
      <CockpitKpisPanel defaultPeriodo="hoje" />
    </main>
  );
}
