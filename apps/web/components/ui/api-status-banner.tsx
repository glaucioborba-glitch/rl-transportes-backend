"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApiHealth } from "@/hooks/use-api-health";

export function ApiStatusBanner() {
  const { isOnline, lastCheck, recheck } = useApiHealth();

  if (isOnline) return null;

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-red-500/30 bg-red-500/10 px-4 py-2">
      <WifiOff className="h-4 w-4 shrink-0 text-red-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-red-400">Servidor indisponível — não foi possível conectar à API.</p>
        <p className="text-xs text-muted-foreground">
          Última verificação: {lastCheck.toLocaleTimeString("pt-BR")}. Verifique se o backend está rodando na porta
          3001.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10"
        onClick={() => void recheck().then((ok) => !ok && window.location.reload())}
      >
        <RefreshCw className="mr-1 h-3.5 w-3.5" />
        Tentar novamente
      </Button>
    </div>
  );
}
