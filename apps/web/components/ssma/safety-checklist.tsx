"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ssmaStorage } from "@/lib/ssma/storage";
import type { ChecklistItem } from "@/lib/ssma/types";

const DEFAULT_TASKS = ["Sinalização no local", "Isolamento da área", "Inspeção EPI", "Inspeção de máquina", "Condições ambientais"];

function ensureItems(): ChecklistItem[] {
  const cur = ssmaStorage.checklist.get();
  if (cur.length) return cur;
  const init = DEFAULT_TASKS.map((t) => ({
    id: crypto.randomUUID(),
    tarefa: t,
    status: "pendente" as const,
    notas: "",
    fotosBase64: [] as string[],
  }));
  ssmaStorage.checklist.set(init);
  return init;
}

export function SafetyChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    setItems(ensureItems());
  }, []);

  function persist(next: ChecklistItem[]) {
    setItems(next);
    ssmaStorage.checklist.set(next);
  }

  function setStatus(id: string, status: ChecklistItem["status"]) {
    persist(items.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  function addPhoto(id: string, files: FileList | null) {
    if (!files?.[0]) return;
    const f = files[0];
    const r = new FileReader();
    r.onload = () => {
      const src = String(r.result ?? "");
      persist(items.map((i) => (i.id === id ? { ...i, fotosBase64: [...i.fotosBase64, src].slice(0, 6) } : i)));
    };
    r.readAsDataURL(f);
  }

  return (
    <div className="space-y-3">
      {items.map((i) => (
        <div key={i.id} className="rounded-xl border border-white/10 bg-zinc-950/50 p-3">
          <p className="font-medium text-zinc-200">{i.tarefa}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["pendente", "ok", "na"] as const).map((s) => (
              <Button key={s} type="button" size="sm" variant={i.status === s ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => setStatus(i.id, s)}>
                {s}
              </Button>
            ))}
          </div>
          <textarea
            className="mt-2 w-full rounded border border-white/10 bg-zinc-900 px-2 py-1 text-xs"
            placeholder="Notas"
            value={i.notas}
            onChange={(e) => persist(items.map((x) => (x.id === i.id ? { ...x, notas: e.target.value } : x)))}
          />
          <input type="file" accept="image/*" className="mt-1 text-[10px]" onChange={(e) => addPhoto(i.id, e.target.files)} />
          <div className="mt-2 flex gap-1">
            {i.fotosBase64.map((src, idx) => (
              <img key={idx} src={src} alt="" className="h-10 w-10 rounded object-cover" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
