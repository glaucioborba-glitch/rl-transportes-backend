"use client";

import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type TimelineStep = {
  key: string;
  title: string;
  done: boolean;
  time?: string | null;
  note?: string | null;
};

export function TimelineMobile({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s.key} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2",
                s.done
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                  : "border-white/20 bg-black/40 text-slate-500",
              )}
            >
              {s.done ? <Check className="h-5 w-5" /> : <Circle className="h-4 w-4" />}
            </div>
            {i < steps.length - 1 ? (
              <div className={cn("w-0.5 flex-1 min-h-[20px]", s.done ? "bg-emerald-500/40" : "bg-white/10")} />
            ) : null}
          </div>
          <div className={cn("pb-8 pt-1", i === steps.length - 1 && "pb-0")}>
            <p className="font-semibold text-white">{s.title}</p>
            {s.time ? <p className="text-xs text-slate-500">{s.time}</p> : null}
            {s.note ? <p className="mt-1 text-sm text-slate-400">{s.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
