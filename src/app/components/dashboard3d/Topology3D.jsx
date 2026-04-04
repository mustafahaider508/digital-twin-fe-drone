"use client";

import React, { useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Grid, Html, OrbitControls } from "@react-three/drei";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useDemoTwins } from "./useDemoTwins";

const HEALTH_COLOR = {
  ok: "#28ff8a",
  warn: "#ffb020",
  critical: "#ff2d6d",
  offline: "#7a7a7a",
};

function EdgeLine({ a, b, heat }) {
  // green -> red based on latency heat
  const color = useMemo(() => {
    const c1 = new THREE.Color("#28ff8a");
    const c2 = new THREE.Color("#ff2d6d");
    return c1.lerp(c2, heat);
  }, [heat]);

  const points = useMemo(() => {
    return [new THREE.Vector3(...a), new THREE.Vector3(...b)];
  }, [a, b]);

  return (
    <line>
      <bufferGeometry setFromPoints={points} />
      <lineBasicMaterial color={color} />
    </line>
  );
}

function TwinNode({ node, selected, onSelect }) {
  const { pos, label, health, telemetry } = node;

  const baseColor = HEALTH_COLOR[health] || "#ffffff";
  const pulseRef = React.useRef();

  useFrame((_, delta) => {
    if (!pulseRef.current) return;
    const pulsing = health === "critical" || telemetry.packetLoss > 3;
    const speed = pulsing ? 3.5 : 0.8;
    pulseRef.current.scale.x = pulseRef.current.scale.y = pulseRef.current.scale.z =
      1 + Math.sin(performance.now() / 220) * (pulsing ? 0.18 : 0.04);
    pulseRef.current.material.opacity = pulsing ? 0.55 : 0.22;
    pulseRef.current.rotation.y += delta * speed;
  });

  return (
    <group position={pos}>
      {/* halo / pulse ring */}
      <mesh ref={pulseRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.32, 36]} />
        <meshBasicMaterial color={baseColor} transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>

      {/* main node */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <sphereGeometry args={[0.18, 28, 28]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={new THREE.Color(baseColor)}
          emissiveIntensity={selected ? 1.2 : 0.35}
          roughness={0.35}
          metalness={0.2}
        />
      </mesh>

      {/* label */}
      <Html distanceFactor={10} position={[0, 0.34, 0]} center>
        <div
          style={{
            padding: "6px 10px",
            borderRadius: 12,
            border: selected ? "1px solid rgba(255,45,109,0.6)" : "1px solid rgba(255,255,255,0.14)",
            background: "rgba(10,10,10,0.62)",
            color: "white",
            fontSize: 12,
            backdropFilter: "blur(8px)",
            whiteSpace: "nowrap",
          }}
        >
          <b style={{ letterSpacing: "0.06em" }}>{label}</b>
          <span style={{ opacity: 0.75 }}> · {health.toUpperCase()}</span>
        </div>
      </Html>
    </group>
  );
}

export default function Topology3D() {
  const { nodesVM, edgesVM, history } = useDemoTwins();
  const [selectedId, setSelectedId] = useState("twin-02");

  const selected = useMemo(
    () => nodesVM.find((n) => n.id === selectedId) || nodesVM[0],
    [nodesVM, selectedId]
  );

  return (
    <div style={{ height: "100vh", width: "100%", display: "grid", gridTemplateColumns: "280px 1fr 360px" }}>
      {/* LEFT SIDEBAR */}
      <aside style={{ borderRight: "1px solid rgba(255,255,255,0.08)", padding: 14 }}>
        <div style={{ fontWeight: 900, letterSpacing: "0.12em", fontSize: 12, opacity: 0.85 }}>
          TWINS (DEMO)
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {nodesVM.map((n) => {
            const c = HEALTH_COLOR[n.health];
            return (
              <button
                key={n.id}
                onClick={() => setSelectedId(n.id)}
                style={{
                  cursor: "pointer",
                  textAlign: "left",
                  borderRadius: 14,
                  padding: "10px 12px",
                  border: n.id === selectedId ? "1px solid rgba(255,45,109,0.55)" : "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(12,12,12,0.55)",
                  color: "white",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: c,
                      boxShadow: `0 0 18px ${c}55`,
                    }}
                  />
                  <div style={{ fontWeight: 900, letterSpacing: "0.06em" }}>{n.label}</div>
                </div>
                <div style={{ marginTop: 6, opacity: 0.8, fontSize: 12 }}>
                  CPU: <b>{n.telemetry.cpu}</b>% · Lat: <b>{n.telemetry.latency}</b>ms · Loss: <b>{n.telemetry.packetLoss}</b>%
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 14, opacity: 0.7, fontSize: 12 }}>
          Tip: click nodes in 3D or select here.
        </div>
      </aside>

      {/* 3D CANVAS */}
      <main style={{ position: "relative" }}>
        {/* legend overlay */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            zIndex: 20,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(10,10,10,0.55)",
            color: "white",
            padding: "10px 12px",
            backdropFilter: "blur(10px)",
            fontSize: 12,
          }}
        >
          <div style={{ fontWeight: 900, letterSpacing: "0.10em", fontSize: 11, opacity: 0.9 }}>LEGEND</div>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            <div><span style={{ color: HEALTH_COLOR.ok }}>●</span> OK</div>
            <div><span style={{ color: HEALTH_COLOR.warn }}>●</span> WARN</div>
            <div><span style={{ color: HEALTH_COLOR.critical }}>●</span> CRITICAL</div>
            <div><span style={{ color: HEALTH_COLOR.offline }}>●</span> OFFLINE</div>
            <div style={{ opacity: 0.75, marginTop: 4 }}>
              Edge color = latency (green → red)
            </div>
          </div>
        </div>

        <Canvas camera={{ position: [0, 2.4, 3.2], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[4, 6, 3]} intensity={1.1} />

          {/* floor grid */}
          <Grid
            position={[0, 0, 0]}
            args={[12, 12]}
            cellSize={0.6}
            cellThickness={0.8}
            sectionSize={2.4}
            sectionThickness={1.2}
            fadeDistance={14}
          />

          {/* edges */}
          {edgesVM.map((e, idx) => {
            const from = nodesVM.find((n) => n.id === e.from)?.pos;
            const to = nodesVM.find((n) => n.id === e.to)?.pos;
            if (!from || !to) return null;
            return <EdgeLine key={idx} a={from} b={to} heat={e.heat} />;
          })}

          {/* nodes */}
          {nodesVM.map((n) => (
            <TwinNode
              key={n.id}
              node={n}
              selected={n.id === selectedId}
              onSelect={setSelectedId}
            />
          ))}

          <OrbitControls enableDamping dampingFactor={0.08} />
        </Canvas>
      </main>

      {/* RIGHT INSPECTOR */}
      <aside style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", padding: 14 }}>
        <div style={{ fontWeight: 900, letterSpacing: "0.12em", fontSize: 12, opacity: 0.85 }}>
          INSPECTOR
        </div>

        <div style={{ marginTop: 10, padding: 12, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(12,12,12,0.55)" }}>
          <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: "0.06em" }}>{selected?.label}</div>
          <div style={{ marginTop: 6, opacity: 0.85, fontSize: 12 }}>
            Status: <b style={{ color: HEALTH_COLOR[selected?.health] }}>{selected?.health?.toUpperCase()}</b>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 13 }}>
            <div>🌡 Temp: <b>{selected?.telemetry.temperature}</b> °C</div>
            <div>🧠 CPU: <b>{selected?.telemetry.cpu}</b> %</div>
            <div>📡 Latency: <b>{selected?.telemetry.latency}</b> ms</div>
            <div>📉 Loss: <b>{selected?.telemetry.packetLoss}</b> %</div>
            <div>🔋 Battery: <b>{selected?.telemetry.battery}</b> %</div>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 12, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(12,12,12,0.55)" }}>
          <div style={{ fontWeight: 900, letterSpacing: "0.10em", fontSize: 11, opacity: 0.9 }}>
            CPU TREND (LAST 60s)
          </div>

          <div style={{ width: "100%", height: 220, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history[selectedId] || []}>
                <XAxis dataKey="t" hide />
                <YAxis hide domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="cpu" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ opacity: 0.7, fontSize: 12 }}>
            (Demo data) — next we’ll replace with SSE from Express.
          </div>
        </div>
      </aside>
    </div>
  );
}
