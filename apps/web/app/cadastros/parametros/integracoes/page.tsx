"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { ParametrosBreadcrumb, ParametrosTabs } from "../components/parametros-tabs";

export default function ParametrosIntegracoesPage() {
  return (
    <div className="space-y-6">
      <ParametrosBreadcrumb current="Integrações" />
      <div>
        <h1 className="text-2xl font-bold">Parâmetros Gerais</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Integrações do sistema não ficam na intranet.
        </p>
      </div>
      <ParametrosTabs />

      <div className="flex max-w-xl items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <p className="font-medium text-foreground">Somente Super Admin</p>
          <p className="mt-1 text-muted-foreground">
            Google Maps, PIX, Vision, WhatsApp, Banking e S3 são configurados em{" "}
            <Link href="/super-admin/integracoes" className="text-[var(--accent)] underline-offset-2 hover:underline">
              Super Admin → Integrações
            </Link>
            . Nenhum funcionário do terminal altera essas chaves.
          </p>
        </div>
      </div>
    </div>
  );
}
