"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PortalPatioSaldoItem } from "@/lib/api/portal-client";
import { formatContainerISO, stripContainerISO } from "@/utils/containerFormatter";

const LIST_MAX_H = 256;

export function ContainerEstoqueSearch({
  value,
  onSelect,
  items,
  loading,
  error,
  excludeIsos,
  required,
  className,
}: {
  value: string;
  onSelect: (item: PortalPatioSaldoItem | null) => void;
  items: PortalPatioSaldoItem[];
  loading?: boolean;
  error?: string | null;
  excludeIsos?: string[];
  required?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxH: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const excluded = useMemo(
    () => new Set((excludeIsos ?? []).map((iso) => stripContainerISO(iso)).filter(Boolean)),
    [excludeIsos],
  );

  const selectedIso = stripContainerISO(value);
  const selected = items.find((i) => stripContainerISO(i.unidadeIso) === selectedIso);

  const filtered = useMemo(() => {
    const compact = q.replace(/[\s-]/g, "").toUpperCase();
    return items.filter((item) => {
      const iso = stripContainerISO(item.unidadeIso);
      if (excluded.has(iso) && iso !== selectedIso) return false;
      if (!compact) return true;
      const blob = [
        iso,
        item.unidadeProcessoLabel ?? "",
        String(item.unidadeProcessoNumero ?? ""),
        item.protocolo,
        item.booking ?? "",
        item.processo ?? "",
        item.navio ?? "",
        item.tipo,
        item.tamanho ?? "",
      ]
        .join(" ")
        .toUpperCase();
      return blob.includes(compact) || blob.includes(q.trim().toUpperCase());
    });
  }, [items, q, excluded, selectedIso]);

  function updateCoords() {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const openUp = spaceBelow < 140 && r.top > spaceBelow;
    const maxH = Math.min(LIST_MAX_H, Math.max(120, openUp ? r.top - 8 : spaceBelow));
    setCoords({
      top: openUp ? r.top - maxH - 4 : r.bottom + 4,
      left: r.left,
      width: r.width,
      maxH,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
    const onWin = () => updateCoords();
    window.addEventListener("resize", onWin);
    document.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      document.removeEventListener("scroll", onWin, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const display = selected
    ? `${formatContainerISO(selected.unidadeIso)}${selected.unidadeProcessoLabel ? ` · ${selected.unidadeProcessoLabel}` : ""}`
    : value;

  const list =
    open && coords ? (
      <div
        ref={listRef}
        data-estoque-search-list=""
        className="overflow-auto rounded-lg border border-white/15 bg-[#0b101c] shadow-xl"
        style={{
          position: "fixed",
          top: coords.top,
          left: coords.left,
          width: coords.width,
          maxHeight: coords.maxH,
          zIndex: 500,
          pointerEvents: "auto",
        }}
      >
        {loading ? (
          <p className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando estoque…
          </p>
        ) : error ? (
          <p className="px-3 py-3 text-xs text-red-400">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-400">
            Nenhuma unidade em estoque deste cliente
            {q.trim() ? " para esta busca" : ""}. Coleta/exportação exige ID aberto.
          </p>
        ) : (
          <ul>
            {filtered.map((item) => {
              const iso = stripContainerISO(item.unidadeIso);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-white/10"
                    onClick={() => {
                      onSelect(item);
                      setQ("");
                      setOpen(false);
                    }}
                  >
                    <span className="font-mono text-sm text-white">
                      {formatContainerISO(iso)}
                      {item.unidadeProcessoLabel ? (
                        <span className="ml-2 text-cyan-300">{item.unidadeProcessoLabel}</span>
                      ) : null}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {[item.tipo, item.tamanho, item.statusContainer, item.statusPatio]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Input
          value={open ? q : display}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (!e.target.value.trim() && selected) onSelect(null);
          }}
          onFocus={() => {
            setQ("");
            setOpen(true);
          }}
          placeholder="Buscar unidade deste cliente…"
          required={required && !selectedIso}
          className={`pr-16 font-mono ${className ?? ""}`}
          autoComplete="off"
          spellCheck={false}
        />
        {selectedIso && !open ? (
          <button
            type="button"
            aria-label="Limpar unidade"
            className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            onClick={() => {
              onSelect(null);
              setQ("");
            }}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Buscar unidades do cliente"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-cyan-300 hover:bg-white/10 hover:text-cyan-200"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setQ("");
            setOpen((v) => !v);
          }}
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
      {typeof document !== "undefined" && list ? createPortal(list, document.body) : null}
    </div>
  );
}
