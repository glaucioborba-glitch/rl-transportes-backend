"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, authLogin, sanitizeCorporateDocumento } from "@/lib/api/corporate-auth-client";
import { toast } from "@/lib/toast";
import { isStaffRole, useStaffAuthStore } from "@/stores/staff-auth-store";

type UseCorporateLoginOpts = {
  cookieMode?: boolean;
  defaultNext?: string;
  onSuccess?: () => void;
};

export function useCorporateLogin(opts?: UseCorporateLoginOpts) {
  const router = useRouter();
  const setSession = useStaffAuthStore((s) => s.setSession);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (documento: string, password: string, next?: string | null) => {
      setError(null);
      const digits = sanitizeCorporateDocumento(documento);
      if (digits.length !== 11 && digits.length !== 14) {
        const msg = "Documento inválido. Use apenas números.";
        setError(msg);
        toast.error(msg);
        return false;
      }

      setSubmitting(true);
      try {
        const res = await authLogin(documento, password, {
          cookieMode: opts?.cookieMode ?? true,
        });
        if (!isStaffRole(res.user.role)) {
          const msg = "Use o portal em /portal/login para usuários CLIENTE.";
          setError(msg);
          toast.error("Perfil não autorizado nesta área.");
          return false;
        }
        setSession(null, null, res.user);
        toast.success("Sessão operacional iniciada");
        opts?.onSuccess?.();
        const dest =
          next && next.startsWith("/") && !next.startsWith("//")
            ? next
            : (opts?.defaultNext ?? "/operador/portaria");
        router.push(dest);
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 400) {
          const msg = "Documento inválido — use apenas números.";
          setError(msg);
          toast.error(msg);
          return false;
        }
        const msg = e instanceof ApiError ? e.message : "Erro inesperado";
        setError(msg);
        toast.error(msg);
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [opts, router, setSession],
  );

  return { login, submitting, error, setError };
}
