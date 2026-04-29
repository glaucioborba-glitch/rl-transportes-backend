"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function Quadra3D({
  position,
  height,
  color,
  emissive,
  onPick,
}: {
  position: [number, number, number];
  height: number;
  color: string;
  emissive?: string;
  onPick: () => void;
}) {
  return (
    <mesh
      position={[position[0], Math.max(0.35, height) / 2 + 0.02, position[2]]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
    >
      <boxGeometry args={[2.2, Math.max(0.35, height), 1.8]} />
      <meshStandardMaterial color={color} emissive={emissive ?? "#000000"} emissiveIntensity={0.25} roughness={0.45} metalness={0.15} />
    </mesh>
  );
}

export function Truck3D({ curve, speed = 0.08, offset = 0 }: { curve: THREE.CatmullRomCurve3; speed?: number; offset?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((st) => {
    if (!ref.current) return;
    const t = (st.clock.elapsedTime * speed + offset) % 1;
    const p = curve.getPointAt(t);
    const p2 = curve.getPointAt(Math.min(1, t + 0.02));
    ref.current.position.copy(p);
    ref.current.lookAt(p2);
  });
  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.45, 1.1]} />
        <meshStandardMaterial color="#38bdf8" metalness={0.3} roughness={0.4} />
      </mesh>
    </group>
  );
}

export function RiskHalo({
  position,
  intensity,
  visible,
}: {
  position: [number, number, number];
  intensity: number;
  visible: boolean;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((st) => {
    if (!mesh.current || !visible) return;
    const s = 1.6 + intensity * 0.9 + Math.sin(st.clock.elapsedTime * 3) * 0.12 * intensity;
    mesh.current.scale.setScalar(s);
  });
  if (!visible || intensity < 0.08) return null;
  return (
    <mesh ref={mesh} position={position}>
      <sphereGeometry args={[1.4, 24, 24]} />
      <meshStandardMaterial color="#ef4444" transparent opacity={0.22} depthWrite={false} />
    </mesh>
  );
}

export function useYardCurve(): THREE.CatmullRomCurve3 {
  return useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-8, 0.3, 6),
        new THREE.Vector3(-2, 0.3, 4),
        new THREE.Vector3(2, 0.3, 0),
        new THREE.Vector3(6, 0.3, -4),
        new THREE.Vector3(10, 0.3, -7),
      ]),
    [],
  );
}
