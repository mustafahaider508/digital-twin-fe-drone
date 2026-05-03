"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";

const TANK_HEIGHT = 1.18;
const SHELL_RADIUS = 0.43;
const FILL_RADIUS = 0.36;

function getBatteryColor(pct, overrideColor) {
  if (overrideColor) return overrideColor;
  if (pct > 0.6) return "#22c55e";
  if (pct > 0.3) return "#f59e0b";
  return "#ef4444";
}

function getBatteryGlow(pct, overrideGlow) {
  if (overrideGlow) return overrideGlow;
  if (pct > 0.6) return "rgba(34,197,94,0.28)";
  if (pct > 0.3) return "rgba(245,158,11,0.28)";
  return "rgba(239,68,68,0.28)";
}

function BatteryShell({ color }) {
  return (
    <group>
      {/* Transparent outer shell */}
      <mesh>
        <cylinderGeometry args={[SHELL_RADIUS, SHELL_RADIUS, TANK_HEIGHT, 64]} />
        <meshPhysicalMaterial
          color="#cfe4ff"
          transparent
          opacity={0.12}
          roughness={0.08}
          metalness={0.12}
          transmission={0.55}
          clearcoat={1}
          clearcoatRoughness={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Top rim */}
      <mesh position={[0, TANK_HEIGHT / 2 - 0.01, 0]}>
        <torusGeometry args={[SHELL_RADIUS * 0.94, 0.028, 16, 80]} />
        <meshStandardMaterial
          color="#1e293b"
          roughness={0.28}
          metalness={0.55}
          emissive="#0f172a"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Bottom rim */}
      <mesh position={[0, -TANK_HEIGHT / 2 + 0.01, 0]}>
        <torusGeometry args={[SHELL_RADIUS * 0.94, 0.03, 16, 80]} />
        <meshStandardMaterial
          color="#1f2937"
          roughness={0.3}
          metalness={0.6}
          emissive={color}
          emissiveIntensity={0.08}
        />
      </mesh>

      {/* Battery top cap */}
      <mesh position={[0, TANK_HEIGHT / 2 + 0.09, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.12, 40]} />
        <meshStandardMaterial
          color="#8fb8ff"
          roughness={0.22}
          metalness={0.75}
          emissive="#60a5fa"
          emissiveIntensity={0.18}
        />
      </mesh>
    </group>
  );
}

function BatteryFill({ value, color }) {
  const raw = Number(value);
  const pct = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0)) / 100;
  const fillHeight = Math.max(pct * (TANK_HEIGHT - 0.08), 0.04);
  const fillCenterY = -TANK_HEIGHT / 2 + fillHeight / 2 + 0.02;

  return (
    <group position={[0, fillCenterY, 0]}>
      <mesh scale={[FILL_RADIUS / 0.5, fillHeight, FILL_RADIUS / 0.5]}>
        <cylinderGeometry args={[0.5, 0.5, 1, 48]} />
        <meshPhysicalMaterial
          color={color}
          emissive={new THREE.Color(color)}
          emissiveIntensity={0.38}
          roughness={0.2}
          metalness={0.08}
          transmission={0.06}
          clearcoat={0.45}
          clearcoatRoughness={0.18}
        />
      </mesh>

      {/* top liquid surface */}
      <mesh position={[0, fillHeight / 2, 0]}>
        <cylinderGeometry args={[FILL_RADIUS, FILL_RADIUS, 0.012, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={new THREE.Color(color)}
          emissiveIntensity={0.22}
          roughness={0.12}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}

function FloorGlow({ color }) {
  return (
    <mesh position={[0, -0.64, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.34, 0.56, 64]} />
      <meshBasicMaterial color={color} transparent opacity={0.16} side={THREE.DoubleSide} />
    </mesh>
  );
}

function BatteryScene({ value, color, glowColor, live }) {
  const raw = Number(value);
  const hasValue = live && Number.isFinite(raw);

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[2.8, 4, 4]} intensity={1.2} />
      <directionalLight position={[-2.5, 2.2, -2]} intensity={0.35} />
      <pointLight position={[0, 0.3, 1.8]} intensity={0.7} color={color} />
      <pointLight position={[0, 1.2, 1.4]} intensity={0.45} color="#93c5fd" />

      <group position={[0, -0.02, 0]} rotation={[0, -0.34, 0]}>
        <FloorGlow color={color} />
        <BatteryShell color={color} />
        {hasValue ? <BatteryFill value={raw} color={color} /> : null}
      </group>

      <Html position={[0, 0.88, 0]} center>
        <div
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "#f8fbff",
            fontVariantNumeric: "tabular-nums",
            textShadow: `0 0 14px ${glowColor}, 0 2px 10px rgba(0,0,0,0.75)`,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {hasValue ? `${Math.round(raw)}%` : "—"}
        </div>
      </Html>
    </>
  );
}

export default function Battery3DGauge({
  value,
  label = "Battery",
  live = false,
  style = {},
  height = 190,
  color,
  glowColor,
}) {
  const raw = Number(value);
  const hasValue = live && Number.isFinite(raw);
  const safePct = hasValue ? Math.max(0, Math.min(100, raw)) / 100 : 0;
  const resolvedColor = useMemo(() => getBatteryColor(safePct, color), [safePct, color]);
  const resolvedGlow = useMemo(() => getBatteryGlow(safePct, glowColor), [safePct, glowColor]);
  const displayValue = hasValue ? raw : null;

  return (
    <div
      style={{
        width: "100%",
        height,
        minHeight: height,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(180deg, rgba(8,18,38,0.88) 0%, rgba(7,14,28,0.76) 100%)",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 30px rgba(0,0,0,0.28), 0 0 0 1px ${resolvedGlow}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: "#8ea3bf",
          letterSpacing: "0.14em",
          padding: "10px 12px 0",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 130,
          position: "relative",
        }}
      >
        <Canvas
          camera={{ position: [0, 0.04, 3.25], fov: 29 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            background: "transparent",
          }}
        >
          <BatteryScene
            value={displayValue}
            color={resolvedColor}
            glowColor={resolvedGlow}
            live={live}
          />
        </Canvas>
      </div>

      <div
        style={{
          padding: "0 12px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 10,
            borderRadius: 999,
            overflow: "hidden",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              width: `${hasValue ? Math.max(0, Math.min(100, displayValue)) : 0}%`,
              height: "100%",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${resolvedColor}, ${resolvedColor})`,
              boxShadow: `0 0 16px ${resolvedGlow}`,
              transition: "width 0.35s ease",
            }}
          />
        </div>

        <div
          style={{
            minWidth: 52,
            textAlign: "right",
            fontSize: 12,
            fontWeight: 800,
            color: resolvedColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {hasValue ? `${Math.round(displayValue)}%` : "—"}
        </div>
      </div>
    </div>
  );
}