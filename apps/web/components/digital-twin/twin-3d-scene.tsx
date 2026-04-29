"use client";

import { Canvas } from "@react-three/fiber";
import { Grid, Html, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import type { MappedQuadra } from "@/lib/digital-twin/derive";
import { bandColorCss } from "@/lib/digital-twin/derive";
import { Quadra3D, RiskHalo, Truck3D, useYardCurve } from "@/components/digital-twin/twin-3d-primitives";

export type Twin3DLayers = {
  trucks: boolean;
  heat: boolean;
  iaRisk: boolean;
  future: boolean;
  ocupacao: boolean;
};

function hexToThree(hex: string): string {
  return hex.length >= 7 ? hex.slice(0, 7) : "#22d3ee";
}

export function Twin3DScene({
  quadras,
  layers,
  onPick,
  riskIntensity,
  projectionLabel,
  projectionSub,
  capacityRef,
}: {
  quadras: MappedQuadra[];
  layers: Twin3DLayers;
  onPick: (q: MappedQuadra) => void;
  riskIntensity: number;
  projectionLabel: string;
  projectionSub: string;
  capacityRef: number;
}) {
  const curve = useYardCurve();
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(Math.max(4, quadras.length || 4)))));
  const qs = quadras.length ? quadras : [{ id: "Q1", label: "Q1", ocupacao: 0, dwellProxyMin: null, risk: "normal" as const }];

  return (
    <div className="h-[min(62vh,640px)] w-full min-h-[420px] overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#02040a]">
      <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true }}>
        <color attach="background" args={["#030510"]} />
        <ambientLight intensity={0.45} />
        <directionalLight castShadow position={[14, 22, 10]} intensity={0.95} shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <PerspectiveCamera makeDefault position={[16, 14, 16]} fov={48} near={0.1} far={120} />
        <OrbitControls enablePan enableZoom maxPolarAngle={Math.PI / 2.15} minDistance={8} maxDistance={42} target={[2, 0, -2]} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#060912" roughness={0.85} metalness={0.05} />
        </mesh>
        <Grid infiniteGrid fadeDistance={55} cellSize={1} sectionSize={5} sectionColor="#1e3a4f" cellColor="#0f172a" position={[0, 0, 0]} />

        {qs.map((q, i) => {
              const row = Math.floor(i / cols);
              const col = i % cols;
              const x = col * 3.4 - ((cols - 1) * 3.4) / 2;
              const z = -row * 2.8;
              const slotEst = Math.max(1, capacityRef / Math.max(1, qs.length));
              const fill = Math.min(1, q.ocupacao / slotEst);
              const h = layers.ocupacao ? 0.5 + fill * 2.8 : 0.85;
              const c = bandColorCss(q.risk);
              const col3 = hexToThree(c.stroke);
              const dim = !layers.heat;
              return (
                <Quadra3D
                  key={q.id}
                  position={[x, 0, z]}
                  height={h}
                  color={dim ? "#0e1a24" : col3}
                  emissive={dim ? "#0c1820" : col3}
                  onPick={() => onPick(q)}
                />
              );
            })}

        {layers.trucks ? (
          <>
            <Truck3D curve={curve} speed={0.06} offset={0} />
            <Truck3D curve={curve} speed={0.06} offset={0.33} />
            <Truck3D curve={curve} speed={0.06} offset={0.66} />
          </>
        ) : null}

        {layers.iaRisk ? <RiskHalo position={[2, 1.1, -2]} intensity={riskIntensity} visible /> : null}

        {layers.future ? (
          <Html position={[8, 3, -6]} center style={{ pointerEvents: "none" }}>
            <div className="w-52 rounded-xl border border-amber-500/40 bg-black/85 px-3 py-2 text-center shadow-2xl backdrop-blur-md">
              <p className="text-[10px] font-bold uppercase text-amber-300">{projectionLabel}</p>
              <p className="text-[9px] leading-snug text-zinc-300">{projectionSub}</p>
            </div>
          </Html>
        ) : null}
      </Canvas>
    </div>
  );
}
