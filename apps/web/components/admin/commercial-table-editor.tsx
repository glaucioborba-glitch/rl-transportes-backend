"use client";

import type { AdminContract } from "@/lib/admin/types";

type C = AdminContract["commercial"];

export function CommercialTableEditor({
  value,
  onChange,
}: {
  value: C;
  onChange: (next: C) => void;
}) {
  function set<K extends keyof C>(k: K, v: C[K]) {
    onChange({ ...value, [k]: v });
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs text-zinc-500">
        Lift on (R$)
        <input
          type="number"
          className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          value={value.liftOn}
          onChange={(e) => set("liftOn", Number(e.target.value))}
        />
      </label>
      <label className="text-xs text-zinc-500">
        Lift off (R$)
        <input
          type="number"
          className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          value={value.liftOff}
          onChange={(e) => set("liftOff", Number(e.target.value))}
        />
      </label>
      <label className="text-xs text-zinc-500">
        Armazenagem / dia (R$)
        <input
          type="number"
          className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          value={value.armazenagem}
          onChange={(e) => set("armazenagem", Number(e.target.value))}
        />
      </label>
      <label className="text-xs text-zinc-500 sm:col-span-2">
        Taxas extras (texto)
        <textarea
          className="mt-1 min-h-[80px] w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          value={value.taxasExtras}
          onChange={(e) => set("taxasExtras", e.target.value)}
        />
      </label>
    </div>
  );
}
