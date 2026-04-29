"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgNode } from "@/lib/rh/organogram";

function NodeRow({
  node,
  depth,
}: {
  node: OrgNode;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasKids = node.children && node.children.length > 0;

  const nivelColor =
    node.nivel === "diretoria"
      ? "text-cyan-300"
      : node.nivel === "coordenacao"
        ? "text-sky-200"
        : "text-zinc-300";

  return (
    <div>
      <div
        className={cn("flex items-center gap-1 py-1.5 text-sm", nivelColor)}
        style={{ paddingLeft: depth * 14 }}
      >
        {hasKids ? (
          <button
            type="button"
            className="rounded p-0.5 hover:bg-white/10"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <span className="font-medium">{node.title}</span>
        <span className="ml-2 text-[10px] uppercase tracking-wider text-zinc-500">{node.nivel}</span>
      </div>
      {open && hasKids
        ? node.children!.map((ch) => <NodeRow key={ch.id} node={ch} depth={depth + 1} />)
        : null}
    </div>
  );
}

export function OrganogramaTree({ root }: { root: OrgNode }) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-zinc-950/60 p-4 font-mono text-sm">
      <NodeRow node={root} depth={0} />
    </div>
  );
}
