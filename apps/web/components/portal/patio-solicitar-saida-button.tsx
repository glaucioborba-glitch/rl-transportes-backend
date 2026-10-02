"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PORTAL_BLOQUEIO_FINANCEIRO_TOAST,
  PORTAL_SCHEDULING_DISABLED_CLASS,
} from "@/lib/portal-financeiro-block";
import type { PortalPatioSaldoItem } from "@/lib/api/portal-client";
import { portalSolicitacaoSaidaHref, SOLICITACAO_SAIDA_OPTIONS } from "@/lib/solicitacao-intent";
import { stashPortalSaidaPrefill } from "@/lib/portal-saida-prefill";
import { toast } from "@/lib/toast";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { usePessoaPermissoesStore } from "@/stores/pessoaPermissoesStore";

export function PatioSolicitarSaidaButton({ item }: { item: PortalPatioSaldoItem }) {
  const router = useRouter();
  const podeCriar = usePessoaPermissoesStore((s) => s.permissoes?.podeCriarSolicitacao ?? true);
  const bloqueadoFin = usePortalClienteAuthStore((s) => s.isBloqueadoFinanceiramente);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onWin() {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open]);

  if (!podeCriar) return null;

  const menu =
    open && !bloqueadoFin && pos ? (
      <div
        ref={menuRef}
        className="w-72 overflow-hidden rounded-lg border border-white/10 bg-[#12151a] shadow-xl"
        style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 80 }}
      >
        {SOLICITACAO_SAIDA_OPTIONS.map((op) => (
          <button
            key={op.value}
            type="button"
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-200 transition hover:bg-white/5"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              stashPortalSaidaPrefill(item);
              router.push(portalSolicitacaoSaidaHref(op.value, item.unidadeIso));
            }}
          >
            {op.label}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div className="relative">
      <Button
        ref={btnRef}
        type="button"
        variant="outline"
        size="sm"
        disabled={bloqueadoFin}
        className={`gap-1 ${PORTAL_SCHEDULING_DISABLED_CLASS}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (bloqueadoFin) {
            toast.error(PORTAL_BLOQUEIO_FINANCEIRO_TOAST);
            return;
          }
          const r = btnRef.current?.getBoundingClientRect();
          if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
          setOpen((v) => !v);
        }}
      >
        Solicitar Saída
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
