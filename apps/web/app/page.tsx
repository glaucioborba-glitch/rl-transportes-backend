import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RL Transportes — Excelência em operação portuária e logística",
  description:
    "Terminal e logística integrados. Acesse o portal do cliente ou a intranet de operação e cockpit.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[#050810] text-slate-100">
      {/* Barra superior — referência: nav corporativa clara + ações */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0a1628]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f] text-sm font-bold tracking-tight text-blue-100 ring-1 ring-blue-400/35">
              RL
            </span>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm font-semibold tracking-wide">RL Transportes</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                Terminal &amp; Logística
              </span>
            </div>
          </Link>

          <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/portal/login"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-orange-400/45 bg-orange-500/[0.08] px-4 text-sm font-semibold text-orange-50 transition hover:border-orange-300/70 hover:bg-orange-500/15"
            >
              Portal do Cliente
            </Link>
            <Link
              href="/login/staff"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-b from-amber-500 to-orange-600 px-4 text-sm font-semibold text-[#0f172a] shadow-lg shadow-orange-600/25 ring-1 ring-orange-400/40 transition hover:from-amber-400 hover:to-orange-500 hover:shadow-orange-500/35"
            >
              Intranet
            </Link>
          </nav>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero — inspirado em hero institucional tipo Portonave */}
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0d2137] to-[#050810]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-24 top-16 h-[28rem] w-[28rem] rounded-full bg-orange-500/[0.12] blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-blue-600/[0.08] blur-3xl"
            aria-hidden
          />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-orange-300/95">
              Operação portuária
            </p>
            <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Com excelência, conectamos sua carga ao mundo.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
              Plataforma integrada para acompanhamento de solicitações, documentos e financeiro — com a
              mesma visão de precisão, segurança e transparência que você espera de uma operação de
              terminal de classe mundial.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link
                href="/portal/login"
                className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-xl border-2 border-orange-400/55 bg-transparent px-6 text-base font-semibold text-orange-100 transition hover:border-orange-300/80 hover:bg-orange-500/[0.12]"
              >
                Acessar Portal do Cliente
              </Link>
              <Link
                href="/login/staff"
                className="inline-flex h-12 min-w-[200px] items-center justify-center rounded-xl bg-gradient-to-b from-amber-500 to-orange-600 px-6 text-base font-semibold text-[#0f172a] shadow-xl shadow-orange-900/40 ring-1 ring-orange-400/45 transition hover:from-amber-400 hover:to-orange-500 hover:shadow-orange-600/30"
              >
                Entrar na Intranet
              </Link>
            </div>
          </div>
        </section>

        {/* Indicadores — bloco tipo métricas institucionais */}
        <section className="border-y border-white/10 bg-[#0a1524]">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {[
              { value: "24/7", label: "Monitoramento operacional contínuo" },
              { value: "100%", label: "Rastreio das etapas no portal" },
              { value: "Secure", label: "Acesso segregado cliente × operação" },
              { value: "API", label: "Integração com seus sistemas" },
            ].map((item) => (
              <div key={item.label} className="text-center lg:text-left">
                <p className="bg-gradient-to-r from-white to-orange-100/90 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
                  {item.value}
                </p>
                <p className="mt-2 text-sm leading-snug text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Serviços — conteúdo relacionado / cards */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-balance text-2xl font-bold text-white sm:text-3xl">
            Conheça nossos canais digitais
          </h2>
          <p className="mt-3 max-w-2xl text-slate-400">
            Do acompanhamento B2B ao cockpit de operações — um ecossistema único para terminal e
            logística.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-[#0d1829] p-6 transition hover:border-orange-500/35">
              <h3 className="text-lg font-semibold text-white">Portal do Cliente</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Solicitações, agendamentos, documentos e visão financeira com transparência em tempo
                real.
              </p>
              <Link
                href="/portal/login"
                className="mt-4 inline-flex text-sm font-semibold text-orange-400 transition hover:text-orange-300"
              >
                Ir para o login →
              </Link>
            </article>
            <article className="rounded-2xl border border-white/10 bg-[#0d1829] p-6 transition hover:border-orange-500/35">
              <h3 className="text-lg font-semibold text-white">Intranet — Operação &amp; Cockpit</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Área restrita para equipe de portaria, pátio, gate e painéis executivos NOC/TOC.
              </p>
              <Link
                href="/login/staff"
                className="mt-4 inline-flex text-sm font-semibold text-orange-400 transition hover:text-orange-300"
              >
                Ir para o login →
              </Link>
            </article>
            <article className="rounded-2xl border border-white/10 bg-[#0d1829] p-6 transition hover:border-orange-500/35">
              <h3 className="text-lg font-semibold text-white">Mobilidade</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Fluxo dedicado para motoristas e operações de campo integradas à base corporativa.
              </p>
              <Link
                href="/motorista/login"
                className="mt-4 inline-flex text-sm font-semibold text-orange-400 transition hover:text-orange-300"
              >
                App motorista →
              </Link>
            </article>
          </div>
        </section>

        <footer className="border-t border-white/10 bg-[#070d16] px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
            <p className="text-center text-sm text-slate-500 sm:text-left">
              © {new Date().getFullYear()} RL Transportes. Todos os direitos reservados.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-400">
              <Link href="/portal/login" className="transition hover:text-orange-300">
                Portal do Cliente
              </Link>
              <Link href="/login/staff" className="transition hover:text-orange-300">
                Intranet
              </Link>
              <Link href="/motorista/login" className="transition hover:text-orange-300">
                Motorista
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
