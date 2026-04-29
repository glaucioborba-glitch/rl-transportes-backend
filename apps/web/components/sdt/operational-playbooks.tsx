"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SDT_PLAYBOOKS, playbookToSynthesized, type Playbook, type PlaybookId } from "@/lib/sdt/playbooks";
import type { SynthesizedAction } from "@/lib/sdt/decision-engine-core";

export function OperationalPlaybooks({
  onPick,
}: {
  onPick: (actions: SynthesizedAction[], pb: Playbook) => void;
}) {
  const [active, setActive] = useState<PlaybookId | null>(null);

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-[#100804] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/80">Auto-ops playbooks</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {SDT_PLAYBOOKS.map((pb) => (
          <Button
            key={pb.id}
            type="button"
            variant={active === pb.id ? "default" : "outline"}
            className={active === pb.id ? "bg-amber-600 hover:bg-amber-500" : "border-amber-500/30 text-left text-zinc-200"}
            onClick={() => {
              setActive(pb.id);
              const actions = playbookToSynthesized(pb, "pb");
              onPick(actions, pb);
            }}
          >
            <div className="text-left">
              <p className="font-semibold">{pb.title}</p>
              <p className="text-[10px] font-normal text-zinc-400">{pb.subtitle}</p>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
