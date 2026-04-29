"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function DigitalSignaturePad({
  onChangeBase64,
}: {
  onChangeBase64: (dataUrl: string | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#0a0a0a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  function pos(e: React.MouseEvent | React.TouchEvent) {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function emitPng() {
    const c = ref.current;
    if (!c || !hasInk) {
      onChangeBase64(null);
      return;
    }
    onChangeBase64(c.toDataURL("image/png"));
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        width={640}
        height={200}
        className="w-full max-w-full touch-none rounded-lg border-2 border-white/20 bg-white"
        onMouseDown={(e) => {
          drawing.current = true;
          const { x, y } = pos(e);
          const ctx = ref.current!.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onMouseUp={() => {
          drawing.current = false;
          emitPng();
        }}
        onMouseLeave={() => {
          drawing.current = false;
          emitPng();
        }}
        onMouseMove={(e) => {
          if (!drawing.current) return;
          const { x, y } = pos(e);
          const ctx = ref.current!.getContext("2d")!;
          ctx.lineTo(x, y);
          ctx.stroke();
          setHasInk(true);
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          drawing.current = true;
          const { x, y } = pos(e);
          const ctx = ref.current!.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          drawing.current = false;
          emitPng();
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          if (!drawing.current) return;
          const { x, y } = pos(e);
          const ctx = ref.current!.getContext("2d")!;
          ctx.lineTo(x, y);
          ctx.stroke();
          setHasInk(true);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            const c = ref.current;
            if (!c) return;
            const ctx = c.getContext("2d")!;
            ctx.fillStyle = "#fff";
            ctx.fillRect(0, 0, c.width, c.height);
            ctx.strokeStyle = "#0a0a0a";
            setHasInk(false);
            onChangeBase64(null);
          }}
        >
          Limpar
        </Button>
      </div>
    </div>
  );
}
