"use client";

import { useEffect, useState } from "react";
import { PontoMobileButton } from "@/components/rh/ponto-mobile-button";
import { RhCard } from "@/components/rh/rh-card";
import { rhPontoKey, readJson, writeJson } from "@/lib/rh/storage";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

type PontoEvent = { t: string; kind: "start" | "break" | "resume" | "end" };

export default function RhJornadaPontoPage() {
  const userId = useStaffAuthStore((s) => s.user?.id ?? "anon");
  const [state, setState] = useState<"idle" | "open" | "break">("idle");
  const [log, setLog] = useState<PontoEvent[]>([]);

  useEffect(() => {
    const prev = readJson<{ state: typeof state; log: PontoEvent[] }>(rhPontoKey(userId), {
      state: "idle",
      log: [],
    });
    setState(prev.state);
    setLog(prev.log);
  }, [userId]);

  function persist(nextState: typeof state, ev: PontoEvent["kind"]) {
    const e: PontoEvent = { t: new Date().toISOString(), kind: ev };
    setState(nextState);
    setLog((prev) => {
      const n = [...prev, e];
      writeJson(rhPontoKey(userId), { state: nextState, log: n });
      return n;
    });
  }

  return (
    <div className="mx-auto max-w-md space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Ponto digital</h1>
        <p className="text-sm text-zinc-500">Somente front — localStorage com trilha auditável visual.</p>
      </div>
      <RhCard title="Estado atual">
        <p className="text-center text-lg font-semibold text-cyan-200">
          {state === "idle" && "Fora de jornada"}
          {state === "open" && "Jornada em curso"}
          {state === "break" && "Em intervalo"}
        </p>
      </RhCard>
      <div className="grid gap-3">
        <PontoMobileButton
          label="Iniciar jornada"
          variant="primary"
          disabled={state !== "idle"}
          onClick={() => persist("open", "start")}
        />
        <PontoMobileButton
          label="Intervalo"
          variant="secondary"
          disabled={state !== "open"}
          onClick={() => persist("break", "break")}
        />
        <PontoMobileButton
          label="Retorno"
          variant="secondary"
          disabled={state !== "break"}
          onClick={() => persist("open", "resume")}
        />
        <PontoMobileButton
          label="Encerrar jornada"
          variant="danger"
          disabled={state === "idle"}
          onClick={() => persist("idle", "end")}
        />
      </div>
      <RhCard title="Auditoria visual (local)">
        <ul className="max-h-64 space-y-1 overflow-y-auto text-xs font-mono text-zinc-400">
          {log
            .slice()
            .reverse()
            .map((l, i) => (
              <li key={i}>
                {l.t} · {l.kind}
              </li>
            ))}
        </ul>
      </RhCard>
    </div>
  );
}
