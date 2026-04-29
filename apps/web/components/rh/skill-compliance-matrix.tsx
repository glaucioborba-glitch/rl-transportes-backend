"use client";

import { RH_COMPETENCY_LABELS, competencyMatrixForUser } from "@/lib/rh/nr-skills-mock";
import type { RhCompetencyId } from "@/lib/rh/types";
import { SkillBadge } from "@/components/rh/skill-badge";
import type { RhColaboradorDirectoryItem } from "@/lib/rh/types";

const COLS: RhCompetencyId[] = [
  "gate",
  "portaria",
  "patio",
  "empilhadeira",
  "seg_operacional",
  "atendimento",
  "compliance_doc",
];

export function SkillComplianceMatrix({ rows }: { rows: RhColaboradorDirectoryItem[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 bg-zinc-900/90">
            <th className="sticky left-0 z-10 bg-zinc-900 px-3 py-2 font-semibold text-zinc-300">Colaborador</th>
            {COLS.map((c) => (
              <th key={c} className="px-2 py-2 font-semibold text-zinc-400">
                {RH_COMPETENCY_LABELS[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const m = competencyMatrixForUser(r.id, r.role);
            return (
              <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                <td className="sticky left-0 z-10 bg-zinc-950/95 px-3 py-2 font-medium text-zinc-200">{r.nome}</td>
                {COLS.map((c) => (
                  <td key={c} className="px-2 py-2">
                    <SkillBadge cell={m[c]} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
