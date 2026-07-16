"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiBase } from "@/lib/api/corporate-auth-client";

export const API_ERROR_CONNECTION = "CONNECTION_REFUSED";
export const API_ERROR_BAD_GATEWAY = "BAD_GATEWAY";
export const API_ERROR_UNAUTHORIZED = "UNAUTHORIZED";

const HEALTH_POLL_MS = 30_000;
const HEALTH_TIMEOUT_MS = 5_000;

/** Backend respondeu (mesmo com dependências degradadas em /health). */
export async function pingApiHealth(): Promise<boolean> {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/health/diagnostic`, {
      method: "GET",
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function useApiHealth() {
  const [isOnline, setIsOnline] = useState(true);
  const [lastCheck, setLastCheck] = useState(() => new Date());

  const checkHealth = useCallback(async () => {
    const ok = await pingApiHealth();
    setIsOnline(ok);
    setLastCheck(new Date());
    return ok;
  }, []);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const ok = await pingApiHealth();
      if (mounted) {
        setIsOnline(ok);
        setLastCheck(new Date());
      }
    })();

    const id = window.setInterval(() => void checkHealth(), HEALTH_POLL_MS);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [checkHealth]);

  return { isOnline, lastCheck, recheck: checkHealth };
}
