"use client";

import { Html } from "@react-three/drei";

export function ProjectionOverlay({
  position,
  title,
  subtitle,
}: {
  position: [number, number, number];
  title: string;
  subtitle: string;
}) {
  return (
    <Html position={position} center style={{ pointerEvents: "none" }}>
      <div className="w-52 rounded-xl border border-amber-400/35 bg-black/85 px-3 py-2 text-center shadow-xl backdrop-blur-md">
        <p className="text-[10px] font-bold uppercase text-amber-200">{title}</p>
        <p className="text-[9px] leading-snug text-zinc-300">{subtitle}</p>
      </div>
    </Html>
  );
}
