"use client";

import { useState } from "react";
import type { AdminContract } from "@/lib/admin/types";
import { formatContabil } from "@/lib/financeiro/format";
import { MoneyInput } from "@/components/ui/money-input";

type C = AdminContract["commercial"];

function toText(n: number) {
  return Number.isFinite(n) ? formatContabil(n) : "";
}

export function CommercialTableEditor({
  value,
  onChange,
}: {
  value: C;
  onChange: (next: C) => void;
}) {
  const [liftOn, setLiftOn] = useState(() => toText(value.liftOn));
  const [liftOff, setLiftOff] = useState(() => toText(value.liftOff));
  const [armazenagem, setArmazenagem] = useState(() => toText(value.armazenagem));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs text-zinc-500">
        Lift on
        <MoneyInput
          className="mt-1"
          value={liftOn}
          onChange={setLiftOn}
          onCommit={(_, n) => onChange({ ...value, liftOn: n })}
        />
      </label>
      <label className="text-xs text-zinc-500">
        Lift off
        <MoneyInput
          className="mt-1"
          value={liftOff}
          onChange={setLiftOff}
          onCommit={(_, n) => onChange({ ...value, liftOff: n })}
        />
      </label>
      <label className="text-xs text-zinc-500">
        Armazenagem / dia
        <MoneyInput
          className="mt-1"
          value={armazenagem}
          onChange={setArmazenagem}
          onCommit={(_, n) => onChange({ ...value, armazenagem: n })}
        />
      </label>
      <label className="text-xs text-zinc-500 sm:col-span-2">
        Taxas extras (texto)
        <textarea
          className="mt-1 min-h-[80px] w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          value={value.taxasExtras}
          onChange={(e) => onChange({ ...value, taxasExtras: e.target.value })}
        />
      </label>
    </div>
  );
}
