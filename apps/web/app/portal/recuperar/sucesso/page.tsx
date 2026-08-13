import Link from "next/link";
import { RlLogo } from "@/components/portal/rl-logo";

export default function PortalRecuperarSucessoPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080a0d] px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <RlLogo className="h-11 w-11 text-lg" />
        <div>
          <h1 className="text-xl font-bold text-white">Instruções enviadas</h1>
          <p className="text-sm text-slate-500">Recuperação de senha</p>
        </div>
      </div>

      <div className="w-full max-w-md rounded-xl border border-white/10 bg-card px-6 py-8 text-center shadow-lg">
        <p className="text-sm leading-relaxed text-slate-300">
          Se o e-mail existir em nossa base, você receberá em instantes instruções para redefinir sua senha.
          Verifique também a pasta de spam.
        </p>
        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/portal/login" className="text-[var(--accent)] hover:underline">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
