"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPortalNotificacoesNaoLidas } from "@/lib/api/portal-client";
import { hasPortalClientSession } from "@/lib/portal-auth-mode";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";

const EVENT = "portal-notificacoes-changed";

export function notifyPortalNotificacoesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function usePortalNotificacoesUnread(pollMs = 30_000) {
  const accessToken = usePortalClienteAuthStore((s) => s.accessToken);
  const sessionHydrated = usePortalClienteAuthStore((s) => s.sessionHydrated);
  const user = usePortalClienteAuthStore((s) => s.user);
  const hasSession = hasPortalClientSession({ accessToken, sessionHydrated, user });
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!hasSession) {
      setCount(0);
      return;
    }
    try {
      const res = await fetchPortalNotificacoesNaoLidas();
      setCount(typeof res.count === "number" ? res.count : 0);
    } catch {
      /* silencioso: o badge não deve interromper a navegação */
    }
  }, [hasSession]);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), pollMs);
    const onChange = () => void refresh();
    window.addEventListener(EVENT, onChange);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(EVENT, onChange);
    };
  }, [refresh, pollMs]);

  return count;
}
