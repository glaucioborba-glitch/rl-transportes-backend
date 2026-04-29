"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearPortalSessionCookie } from "@/lib/auth-cookie";
import { usePortalAuthStore } from "@/stores/portal-store";
import { PortalHeader } from "./portal-header";

export function PortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = usePortalAuthStore((s) => s.accessToken);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(usePortalAuthStore.persist.rehydrate()).finally(() => {
      if (!cancelled) setStorageReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    if (!accessToken) {
      clearPortalSessionCookie();
      router.replace(`/login?next=${encodeURIComponent(pathname ?? "/portal/dashboard")}`);
    }
  }, [accessToken, router, pathname, storageReady]);

  if (!storageReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080a0d] text-slate-400">
        Carregando…
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080a0d] text-slate-400">
        Redirecionando…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]">
      <PortalHeader />
      {children}
    </div>
  );
}
