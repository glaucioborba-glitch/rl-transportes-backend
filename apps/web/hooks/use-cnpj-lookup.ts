"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { validateCnpjDigits } from "@/lib/br-documents";
import {
  buscarDadosCnpj,
  CNPJ_LOOKUP_FAIL_TOAST,
  isCnpjLookupBenignError,
  type CnpjDadosEmpresa,
} from "@/lib/brasilapi/cnpj";
import { toast } from "@/lib/toast";

const LOOKUP_MAX_ATTEMPTS = 3;
const LOOKUP_RETRY_DELAY_MS = 700;

let routeWarmedUp = false;

function warmCnpjLookupRoute(): void {
  if (routeWarmedUp || typeof window === "undefined") return;
  routeWarmedUp = true;
  void fetch("/api/external/cnpj/00000000000000", {
    method: "GET",
    headers: { Accept: "application/json", "X-Cnpj-Warmup": "1" },
  }).catch(() => {
    /* compila a rota BFF antes da primeira digitação */
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Dispara busca na BrasilAPI ao completar 14 dígitos de CNPJ válido (PJ).
 * Falhas e timeout exibem toast amarelo e liberam digitação manual.
 */
export function useCnpjLookup(cnpjFormatted: string, options?: { enabled?: boolean; debounceMs?: number }) {
  const enabled = options?.enabled ?? true;
  const debounceMs = options?.debounceMs ?? 400;
  const digits = useMemo(() => cnpjFormatted.replace(/\D/g, ""), [cnpjFormatted]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CnpjDadosEmpresa | null>(null);
  const seq = useRef(0);
  const lastFetchedDigits = useRef("");

  useEffect(() => {
    if (enabled) warmCnpjLookupRoute();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || digits.length !== 14 || !validateCnpjDigits(digits)) {
      seq.current += 1;
      setLoading(false);
      if (digits.length !== 14) {
        setData(null);
        lastFetchedDigits.current = "";
      }
      return;
    }

    if (lastFetchedDigits.current === digits) {
      return;
    }

    const ac = new AbortController();
    const mySeq = ++seq.current;

    const t = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          for (let attempt = 0; attempt < LOOKUP_MAX_ATTEMPTS; attempt++) {
            if (ac.signal.aborted || mySeq !== seq.current) return;
            if (attempt > 0) {
              await sleep(LOOKUP_RETRY_DELAY_MS, ac.signal);
            }
            try {
              const result = await buscarDadosCnpj(digits, ac.signal, enabled);
              if (mySeq !== seq.current) return;
              lastFetchedDigits.current = digits;
              setData(result);
              return;
            } catch (e) {
              if (isCnpjLookupBenignError(e) || ac.signal.aborted || mySeq !== seq.current) return;
              if (attempt < LOOKUP_MAX_ATTEMPTS - 1) continue;
              setData(null);
              toast.warning(CNPJ_LOOKUP_FAIL_TOAST);
            }
          }
        } finally {
          if (!ac.signal.aborted && mySeq === seq.current) {
            setLoading(false);
          }
        }
      })();
    }, debounceMs);

    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [digits, enabled, debounceMs]);

  return {
    loading,
    loadingCnpj: loading,
    data,
    cnpjDigits: digits,
  };
}
