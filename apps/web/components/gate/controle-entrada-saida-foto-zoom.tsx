"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

const MIN = 1;
const MAX = 8;
const FACTOR = 1.14;

type Props = {
  src: string;
  alt: string;
  compact?: boolean;
};

/**
 * Visualizador de foto com zoom pela roda do mouse e pan por arraste.
 * O zoom é em direção ao cursor para inspecionar um detalhe (lacre, dígito, avaria).
 */
export function ControleEntradaSaidaFotoZoom({ src, alt, compact }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  function reset() {
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  useEffect(() => {
    reset();
  }, [src]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top - rect.height / 2;
      const prev = zoomRef.current;
      const next = Math.min(MAX, Math.max(MIN, prev * (e.deltaY < 0 ? FACTOR : 1 / FACTOR)));
      const ratio = next / prev;
      const o = offsetRef.current;
      const nextOffset =
        next <= MIN
          ? { x: 0, y: 0 }
          : { x: o.x + mx * (1 - ratio), y: o.y + my * (1 - ratio) };
      zoomRef.current = next;
      offsetRef.current = nextOffset;
      setZoom(next);
      setOffset(nextOffset);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (zoomRef.current <= MIN) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y };
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const next = { x: drag.ox + (e.clientX - drag.x), y: drag.oy + (e.clientY - drag.y) };
    offsetRef.current = next;
    setOffset(next);
  }

  function endDrag() {
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <div className="space-y-2">
      <div
        ref={viewportRef}
        className={cn(
          "relative overflow-hidden rounded-md bg-black touch-none select-none overscroll-contain",
          compact ? "min-h-[36vh] max-h-[63vh] sm:min-h-[48vh]" : "max-h-[70vh]",
        )}
        style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={reset}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn(
            "w-full object-contain",
            compact ? "min-h-[36vh] max-h-[63vh] sm:min-h-[48vh]" : "max-h-[70vh]",
          )}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: dragging ? "none" : "transform 80ms ease-out",
          }}
        />
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        Role o mouse para ampliar · arraste para mover · clique duplo para resetar
        {zoom > 1 ? ` · ${Math.round(zoom * 100)}%` : ""}
      </p>
    </div>
  );
}
