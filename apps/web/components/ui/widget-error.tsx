"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/corporate-auth-client";
import { API_ERROR_CONNECTION } from "@/hooks/use-api-health";

export function WidgetError({
  title,
  message = "Não foi possível carregar os dados.",
  onRetry,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 py-8">
      <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="max-w-xs text-center text-xs text-muted-foreground/70">{message}</p>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

export function useWidgetData<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; error: ApiError | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => setRefetchTrigger((n) => n + 1), []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    void fetcher()
      .then((result) => {
        if (mounted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const apiErr =
          err instanceof ApiError
            ? err
            : new ApiError(
                err instanceof Error ? err.message : "Erro ao carregar dados",
                0,
                undefined,
                API_ERROR_CONNECTION,
              );
        if (apiErr.code !== API_ERROR_CONNECTION) {
          console.error("[Widget] Error:", apiErr);
        }
        setError(apiErr);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps controlam refetch externo
  }, [refetchTrigger, ...deps]);

  return { data, loading, error, refetch };
}
