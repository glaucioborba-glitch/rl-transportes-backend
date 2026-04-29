type Ev = { id: string; at: string; label: string; tone?: "neutral" | "warn" | "crit" };

export function ComplianceTimeline({ events }: { events: Ev[] }) {
  return (
    <ol className="relative m-0 list-none border-l border-sky-500/25 pl-4">
      {events.map((e) => (
        <li key={e.id} className="mb-6">
          <span
            className={
              e.tone === "crit"
                ? "absolute -left-[5px] mt-1 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]"
                : e.tone === "warn"
                  ? "absolute -left-[5px] mt-1 h-2 w-2 rounded-full bg-amber-400"
                  : "absolute -left-[5px] mt-1 h-2 w-2 rounded-full bg-sky-400"
            }
          />
          <p className="text-[11px] font-mono text-zinc-500">{e.at}</p>
          <p className="text-sm text-zinc-200">{e.label}</p>
        </li>
      ))}
    </ol>
  );
}
