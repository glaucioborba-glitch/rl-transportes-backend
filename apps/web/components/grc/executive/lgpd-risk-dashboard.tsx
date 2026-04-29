"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const K_LGPD = "rl_grc_lgpd_checklist_v1";

type LgpdCheck = {
  basesLegais: boolean;
  retencao: boolean;
  anpdDpo: boolean;
  minimoNecessario: boolean;
};

const defaultCheck: LgpdCheck = {
  basesLegais: true,
  retencao: true,
  anpdDpo: false,
  minimoNecessario: true,
};

function readCheck(): LgpdCheck {
  if (typeof window === "undefined") return defaultCheck;
  try {
    const raw = localStorage.getItem(K_LGPD);
    if (!raw) return defaultCheck;
    return { ...defaultCheck, ...JSON.parse(raw) } as LgpdCheck;
  } catch {
    return defaultCheck;
  }
}

function writeCheck(v: LgpdCheck) {
  if (typeof window === "undefined") return;
  localStorage.setItem(K_LGPD, JSON.stringify(v));
}

const RISKS = [
  { id: "vaz", label: "Vazamento / exposição indevida", hint: "Logs, exportações e integrações." },
  { id: "ace", label: "Acesso indevido", hint: "Perfis, escopos e 403 em trilha." },
  { id: "ret", label: "Retenção excessiva", hint: "Dados além do necessário ao negócio." },
] as const;

export function LgpdRiskDashboard({
  countColaboradores,
  countClientes,
  countMotoristas,
}: {
  countColaboradores: number | null;
  countClientes: number | null;
  countMotoristas: number | null;
}) {
  const [chk, setChk] = useState<LgpdCheck>(defaultCheck);

  useEffect(() => {
    setChk(readCheck());
  }, []);

  function patch<K extends keyof LgpdCheck>(k: K, v: LgpdCheck[K]) {
    const n = { ...chk, [k]: v };
    setChk(n);
    writeCheck(n);
  }

  const inv = [
    { k: "Colaboradores (users)", n: countColaboradores, d: "Identificação, jornada, saúde ocupacional quando aplicável." },
    { k: "Clientes", n: countClientes, d: "Representantes legais, faturamento e dados contratuais." },
    { k: "Motoristas", n: countMotoristas, d: "CNH, check-ins operacionais e telemetria (quando tratados)." },
  ];

  const ctrlOk = [chk.basesLegais, chk.retencao, chk.anpdDpo, chk.minimoNecessario].filter(Boolean).length;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-5 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/80">Inventário (estimativa via APIs)</p>
        <div className="space-y-2">
          {inv.map((r) => (
            <div key={r.k} className="rounded-xl border border-white/10 bg-[#080c14] p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-white">{r.k}</p>
                <span className="font-mono text-lg text-indigo-200">{r.n != null ? r.n : "—"}</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">{r.d}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600">Contagens via <code className="text-zinc-500">GET /users</code> e <code className="text-zinc-500">GET /clientes</code> quando disponíveis. Motoristas podem residir em cadastros logísticos externos.</p>
      </div>
      <div className="lg:col-span-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-rose-300/80">Mapa de riscos LGPD</p>
        <ul className="space-y-2">
          {RISKS.map((x) => (
            <li key={x.id} className="rounded-xl border border-rose-900/30 bg-rose-950/10 px-4 py-3">
              <p className="text-sm font-medium text-rose-100/90">{x.label}</p>
              <p className="text-[11px] text-zinc-500">{x.hint}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="lg:col-span-3 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300/80">Controles &amp; ANPD</p>
        <p className="text-[11px] text-zinc-500">Checklist persistido apenas no navegador.</p>
        <div className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/50 p-4">
          {(
            [
              ["basesLegais", "Bases legais documentadas (contrato, legítimo interesse onde cabível)"] as const,
              ["retencao", "Política de retenção e descarte"] as const,
              ["minimoNecessario", "Coleta mínima necessária (purpose limitation)"] as const,
              ["anpdDpo", "Canal com DPO / registro ANPD quando exigido"] as const,
            ] as const
          ).map(([key, lab]) => (
            <label key={key} className="flex cursor-pointer items-start gap-2 text-[11px] text-zinc-400">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-zinc-600"
                checked={chk[key]}
                onChange={(e) => patch(key, e.target.checked)}
              />
              <span>{lab}</span>
            </label>
          ))}
          <p className={cn("pt-2 text-center text-xs font-semibold", ctrlOk >= 3 ? "text-emerald-300" : "text-amber-300")}>
            {ctrlOk}/4 controles marcados
          </p>
        </div>
      </div>
    </div>
  );
}
