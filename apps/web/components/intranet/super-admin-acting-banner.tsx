"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getIntranetSessao, sairIntranetTenant } from "@/lib/api/super-admin-client";
import { readSaActingTenantLabel } from "@/lib/super-admin-acting-cookie";
import { useStaffAuthStore } from "@/stores/staff-auth-store";

type Props = {
  compact?: boolean;
};

export function SuperAdminActingBanner({ compact = false }: Props) {
  const router = useRouter();
  const role = useStaffAuthStore((s) => s.user?.role);
  const [nome, setNome] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (role !== "SUPER_ADMIN") return;
    const fromCookie = readSaActingTenantLabel();
    if (fromCookie) setNome(fromCookie);
    void getIntranetSessao()
      .then((s) => {
        if (s.acting && s.nome) setNome(s.nome);
      })
      .catch(() => {
        /* banner usa o cookie se a API falhar */
      });
  }, [role]);

  if (role !== "SUPER_ADMIN") return null;

  async function voltar() {
    setBusy(true);
    try {
      await sairIntranetTenant();
    } catch {
      /* cookie local ainda é limpo pelo proxy */
    }
    router.replace("/super-admin");
  }

  return (
    <div
      className={
        compact
          ? "flex items-center justify-between gap-2 border-b border-violet-500/30 bg-violet-950/50 px-3 py-1.5 text-xs text-violet-100"
          : "flex items-center justify-between gap-3 border-b border-violet-500/30 bg-violet-950/40 px-4 py-1.5 text-xs text-violet-100"
      }
    >
      <p className="min-w-0 truncate">
        Dono do software
        {nome ? (
          <>
            {" · "}
            <span className="font-medium text-white">{nome}</span>
          </>
        ) : null}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 shrink-0 border-violet-400/40 bg-transparent px-2 text-[11px] text-violet-100 hover:bg-violet-900/60"
        disabled={busy}
        onClick={() => void voltar()}
      >
        {busy ? "Saindo…" : "Voltar ao Super Admin"}
      </Button>
    </div>
  );
}
