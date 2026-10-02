"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { TERMOS_ACEITE_LABEL, TERMOS_USO_TEXTO } from "@/lib/legal/termos-uso-content";

type TermosAceitePanelProps = {
  aceiteTermos: boolean;
  onAceiteChange: (value: boolean) => void;
  /** Exige rolagem até o final antes de habilitar o checkbox. */
  requireScrollToEnd?: boolean;
  className?: string;
  scrollClassName?: string;
  /** Oculta checkbox interno (ex.: footer externo alinhado ao botão submit). */
  hideCheckbox?: boolean;
  /** Oculta título interno (título no grid pai). */
  hideTitle?: boolean;
  /** Filhos diretos com col-span-12 no grid do formulário pai. */
  embeddedInForm?: boolean;
  /** Notifica quando o aceite pode ser marcado (scroll completo). */
  onCheckboxEnabledChange?: (enabled: boolean) => void;
  /** Texto dos termos (fallback: constante local). */
  conteudo?: string;
};

export function TermosAceitePanel({
  aceiteTermos,
  onAceiteChange,
  requireScrollToEnd = true,
  className,
  scrollClassName,
  hideCheckbox = false,
  hideTitle = false,
  embeddedInForm = false,
  onCheckboxEnabledChange,
  conteudo = TERMOS_USO_TEXTO,
}: TermosAceitePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(!requireScrollToEnd);

  const checkScrollEnd = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    if (atEnd) setScrolledToEnd(true);
  }, []);

  const checkboxEnabled = !requireScrollToEnd || scrolledToEnd;

  useEffect(() => {
    onCheckboxEnabledChange?.(checkboxEnabled);
  }, [checkboxEnabled, onCheckboxEnabledChange]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 8) {
      setScrolledToEnd(true);
    }
  }, [conteudo]);

  const rootClass = embeddedInForm
    ? cn("contents", className)
    : cn("grid grid-cols-12 gap-x-4 gap-y-2", className);

  return (
    <div className={rootClass}>
      {!hideTitle ? (
        <h2 className="col-span-12 text-lg font-semibold text-slate-100">Termos de Uso e Condições Gerais</h2>
      ) : null}
      <div
        ref={scrollRef}
        onScroll={checkScrollEnd}
        className={cn(
          "col-span-12 overflow-y-auto rounded-lg border border-white/15 bg-zinc-950/80 p-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-300",
          scrollClassName ?? "max-h-56",
        )}
        role="region"
        aria-label="Termos de Uso e Condições Gerais"
        tabIndex={0}
      >
        {conteudo}
      </div>
      {requireScrollToEnd && !scrolledToEnd ? (
        <p className="col-span-12 text-[11px] text-amber-400/90">
          Role até o final dos termos para habilitar o aceite.
        </p>
      ) : null}
      {!hideCheckbox ? (
        <label
          className={cn(
            "col-span-12 flex items-start gap-2 text-sm text-slate-300",
            !checkboxEnabled && "cursor-not-allowed opacity-60",
          )}
        >
          <input
            type="checkbox"
            checked={aceiteTermos}
            disabled={!checkboxEnabled}
            onChange={(e) => onAceiteChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500"
            required
          />
          <span>{TERMOS_ACEITE_LABEL}</span>
        </label>
      ) : null}
    </div>
  );
}

/** Checkbox de aceite reutilizável (footer externo ao painel de termos). */
export function TermosAceiteCheckbox({
  aceiteTermos,
  onAceiteChange,
  enabled = true,
  className,
}: {
  aceiteTermos: boolean;
  onAceiteChange: (value: boolean) => void;
  enabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-2 text-sm text-slate-300",
        !enabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        type="checkbox"
        checked={aceiteTermos}
        disabled={!enabled}
        onChange={(e) => onAceiteChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500"
        required
      />
      <span className="leading-snug">{TERMOS_ACEITE_LABEL}</span>
    </label>
  );
}
