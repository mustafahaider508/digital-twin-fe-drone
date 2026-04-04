"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Html } from "@react-three/drei";

/**
 * Dummy telemetry generator (smooth-ish values, updates every 1s)
 * Later, you can replace this with real MQTT/Express API calls.
 */
function useDummyTelemetry() {
  const [t, setT] = useState({
    twinId: "twin-drone-01",
    temperature: 24.5,
    humidity: 52,
    cpu: 18,
    latency: 35,
    packetLoss: 0.2,
    battery: 100,
    ts: new Date().toISOString(),
  });

  useEffect(() => {
    let tick = 0;

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const wave = (x, min, max, noise = 0.08) => {
      const mid = (min + max) / 2;
      const amp = (max - min) / 2;
      const base = mid + amp * Math.sin(x);
      const jitter = (Math.random() * 2 - 1) * amp * noise;
      return clamp(base + jitter, min, max);
    };

    const id = setInterval(() => {
      tick += 0.18;

      setT((prev) => {
        const temperature = +wave(tick * 0.9, 18, 38, 0.10).toFixed(2);
        const humidity = +wave(tick * 0.6, 30, 80, 0.08).toFixed(2);
        const cpu = +wave(tick * 1.2, 5, 95, 0.12).toFixed(2);
        const latency = +wave(tick * 1.0, 5, 220, 0.16).toFixed(2);
        const packetLoss = +wave(tick * 1.6, 0, 6, 0.20).toFixed(2);

        // battery slowly drains, then resets
        let battery = prev.battery - 0.15;
        if (battery <= 10) battery = 100;

        return {
          ...prev,
          temperature,
          humidity,
          cpu,
          latency,
          packetLoss,
          battery: +battery.toFixed(2),
          ts: new Date().toISOString(),
        };
      });
    }, 1000);

    return () => clearInterval(id);
  }, []);

  return t;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function map01(v, min, max) {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}

function fmtTs(ts) {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "";
  }
}

function Propeller({ position = [0, 0, 0], speed = 12 }) {
  const ref = useRef();

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * speed;
  });

  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[0.08, 0.08, 0.06, 24]} />
        <meshStandardMaterial metalness={0.7} roughness={0.25} />
      </mesh>

      <mesh ref={ref} position={[0, 0.05, 0]}>
        <boxGeometry args={[0.55, 0.02, 0.08]} />
        <meshStandardMaterial roughness={0.35} />
      </mesh>

      <mesh ref={ref} position={[0, 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.55, 0.02, 0.08]} />
        <meshStandardMaterial roughness={0.35} />
      </mesh>
    </group>
  );
}

function Drone({ telemetry }) {
  const group = useRef();
  const bodyMat = useRef();

  // Map telemetry → visuals
  const tempT = map01(telemetry.temperature, 18, 38); // 0..1
  const cpuT = map01(telemetry.cpu, 5, 95);
  const latencyT = map01(telemetry.latency, 5, 220);

  // Prop speed reacts to CPU
  const propSpeed = lerp(8, 28, cpuT);

  useFrame((state) => {
    if (!group.current) return;

    const t = state.clock.getElapsedTime();

    // subtle hover + slight shake with latency
    const shake = lerp(0.0, 0.02, latencyT);
    group.current.position.y = 0.35 + Math.sin(t * 1.2) * 0.03;
    group.current.rotation.y = Math.sin(t * 0.35) * 0.15;
    group.current.rotation.x = Math.sin(t * 2.0) * shake;
    group.current.rotation.z = Math.cos(t * 2.2) * shake;

    // temperature → body color (cool → warm)
    if (bodyMat.current) {
      const cool = new THREE.Color("#2aa3ff");
      const warm = new THREE.Color("#ff2d6d");
      bodyMat.current.color.copy(cool).lerp(warm, tempT);
    }
  });

  const armMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 }),
    []
  );

  const warn = telemetry.battery < 20 || telemetry.packetLoss > 3;

  return (
    <group ref={group}>
      {/* On-drone HUD */}
      {/* <Html position={[0, 0.75, 0]} center>
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(10,10,10,0.72)",
            color: "white",
            fontSize: 12,
            minWidth: 220,
            backdropFilter: "blur(8px)",
            boxShadow: warn ? "0 0 22px rgba(255,45,109,0.55)" : "none",
          }}
        >
          <div style={{ fontWeight: 900, letterSpacing: "0.08em", fontSize: 11, opacity: 0.9 }}>
            {telemetry.twinId} · LIVE
          </div>
          <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
            <div>🌡 Temp: <b>{telemetry.temperature}</b> °C</div>
            <div>🧠 CPU: <b>{telemetry.cpu}</b> %</div>
            <div>📡 Latency: <b>{telemetry.latency}</b> ms</div>
            <div>📉 Loss: <b>{telemetry.packetLoss}</b> %</div>
            <div>🔋 Battery: <b>{telemetry.battery}</b> %</div>
          </div>
          <div style={{ marginTop: 8, opacity: 0.75 }}>
            Updated: {fmtTs(telemetry.ts)}
          </div>
        </div>
      </Html> */}

      {/* Main body */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.9, 0.18, 0.6]} />
        <meshStandardMaterial ref={bodyMat} roughness={0.25} metalness={0.2} />
      </mesh>

      {/* Top shell */}
      <mesh position={[0, 0.46, 0]}>
        <capsuleGeometry args={[0.25, 0.35, 10, 20]} />
        <meshStandardMaterial roughness={0.35} metalness={0.15} />
      </mesh>

      {/* Camera */}
      <group position={[0, 0.28, 0.34]}>
        <mesh>
          <boxGeometry args={[0.18, 0.12, 0.12]} />
          <meshStandardMaterial roughness={0.2} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.07]}>
          <sphereGeometry args={[0.05, 24, 24]} />
          <meshStandardMaterial roughness={0.05} metalness={0.2} />
        </mesh>
      </group>

      {/* Arms */}
      <mesh position={[0.38, 0.35, 0.28]} rotation={[0, Math.PI / 4, 0]} material={armMaterial}>
        <boxGeometry args={[0.7, 0.06, 0.12]} />
      </mesh>
      <mesh position={[-0.38, 0.35, -0.28]} rotation={[0, Math.PI / 4, 0]} material={armMaterial}>
        <boxGeometry args={[0.7, 0.06, 0.12]} />
      </mesh>
      <mesh position={[-0.38, 0.35, 0.28]} rotation={[0, -Math.PI / 4, 0]} material={armMaterial}>
        <boxGeometry args={[0.7, 0.06, 0.12]} />
      </mesh>
      <mesh position={[0.38, 0.35, -0.28]} rotation={[0, -Math.PI / 4, 0]} material={armMaterial}>
        <boxGeometry args={[0.7, 0.06, 0.12]} />
      </mesh>

      {/* Propellers */}
      <Propeller position={[0.62, 0.39, 0.44]} speed={propSpeed} />
      <Propeller position={[-0.62, 0.39, 0.44]} speed={propSpeed} />
      <Propeller position={[0.62, 0.39, -0.44]} speed={propSpeed} />
      <Propeller position={[-0.62, 0.39, -0.44]} speed={propSpeed} />

      {/* Landing legs */}
      <mesh position={[0.3, 0.2, 0]} rotation={[0, 0, Math.PI / 20]}>
        <cylinderGeometry args={[0.02, 0.02, 0.35, 16]} />
        <meshStandardMaterial roughness={0.6} />
      </mesh>
      <mesh position={[-0.3, 0.2, 0]} rotation={[0, 0, -Math.PI / 20]}>
        <cylinderGeometry args={[0.02, 0.02, 0.35, 16]} />
        <meshStandardMaterial roughness={0.6} />
      </mesh>

      {/* Warning light */}
      <mesh position={[0, 0.52, -0.18]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial
          emissive={new THREE.Color(warn ? "#ff2d6d" : "#28ff8a")}
          emissiveIntensity={warn ? 2.2 : 1.3}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

export default function DroneScene() {
  const telemetry = useDummyTelemetry();

  return (
    <div style={{ height: "100vh", width: "100%", position: "relative" }}>
      {/* HUD panel (2D) */}
      <div
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          zIndex: 20,
          width: 280,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(10,10,10,0.55)",
          color: "white",
          padding: 14,
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ fontWeight: 900, letterSpacing: "0.08em", fontSize: 11, opacity: 0.9 }}>
          TELEMETRY (DUMMY)
        </div>
        <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 13 }}>
          <div>🌡 Temperature: <b>{telemetry.temperature}</b> °C</div>
          <div>💧 Humidity: <b>{telemetry.humidity}</b> %</div>
          <div>🧠 CPU: <b>{telemetry.cpu}</b> %</div>
          <div>📡 Latency: <b>{telemetry.latency}</b> ms</div>
          <div>📉 Packet Loss: <b>{telemetry.packetLoss}</b> %</div>
          <div>🔋 Battery: <b>{telemetry.battery}</b> %</div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>Updated: {fmtTs(telemetry.ts)}</div>
        </div>
      </div>

      <Canvas camera={{ position: [2.6, 1.6, 2.6], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 6, 3]} intensity={1.2} />
        <Environment preset="city" />

        {/* Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial roughness={0.95} />
        </mesh>

        <Drone telemetry={telemetry} />
        <OrbitControls enableDamping dampingFactor={0.08} />
      </Canvas>
    </div>
  );
}
