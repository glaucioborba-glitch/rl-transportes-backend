import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#080a0d] px-6 text-center">
      <h1 className="text-2xl font-bold text-white">RL Transportes</h1>
      <p className="max-w-md text-sm text-slate-400">Acesse o portal do cliente ou a operação de terminal.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/login"
          className="inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-xl bg-[var(--accent)] px-6 font-semibold text-[var(--accent-foreground)]"
        >
          Portal do cliente
        </Link>
        <Link
          href="/motorista/login"
          className="inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-6 font-semibold text-emerald-200 hover:bg-emerald-900/40"
        >
          App motorista
        </Link>
        <Link
          href="/operador/login"
          className="inline-flex min-h-12 min-w-[200px] items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 font-semibold text-white hover:bg-white/10"
        >
          Operação / Cockpit
        </Link>
      </div>
    </main>
  );
}
