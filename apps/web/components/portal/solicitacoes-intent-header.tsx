"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SolicitacaoFormModal } from "@/components/portal/solicitacao-form-modal";
import { SOLICITACAO_INTENT_OPTIONS } from "@/lib/solicitacao-intent";
import type { TipoOperacaoSolicitacaoIntent } from "@/lib/api/portal-client";
import { PORTAL_SCHEDULING_DISABLED_CLASS } from "@/lib/portal-financeiro-block";
import { usePortalClienteAuthStore } from "@/stores/portalClienteAuthStore";
import { usePessoaPermissoesStore } from "@/stores/pessoaPermissoesStore";

export { SOLICITACAO_INTENT_OPTIONS } from "@/lib/solicitacao-intent";

export function SolicitacoesIntentHeader({ onCreated }: { onCreated?: () => void }) {
  const podeCriar = usePessoaPermissoesStore((s) => s.permissoes?.podeCriarSolicitacao ?? true);
  const bloqueadoFin = usePortalClienteAuthStore((s) => s.isBloqueadoFinanceiramente);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<{
    open: boolean;
    intent: TipoOperacaoSolicitacaoIntent | null;
  }>({ open: false, intent: null });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  if (!podeCriar) return null;

  return (
    <div className="relative" ref={menuRef}>
      <Button
        onClick={() => !bloqueadoFin && setMenuOpen((o) => !o)}
        disabled={bloqueadoFin}
        className={`gap-2 ${PORTAL_SCHEDULING_DISABLED_CLASS}`}
      >
        Nova solicitação
        <ChevronDown className="h-4 w-4" />
      </Button>
      {menuOpen && !bloqueadoFin ? (
        <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-lg border border-white/10 bg-[#12151a] shadow-xl">
          {SOLICITACAO_INTENT_OPTIONS.map((op) => (
            <button
              key={op.value}
              type="button"
              className="block w-full px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/5"
              onClick={() => {
                setModal({ open: true, intent: op.value });
                setMenuOpen(false);
              }}
            >
              {op.label}
            </button>
          ))}
        </div>
      ) : null}
      <SolicitacaoFormModal
        open={modal.open}
        intent={modal.intent}
        onClose={() => setModal({ open: false, intent: null })}
        onCreated={onCreated}
      />
    </div>
  );
}
