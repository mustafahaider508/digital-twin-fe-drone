"use client";

import React from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Html } from "@react-three/drei";

const DEG = Math.PI / 180;

function Dial({ value, min, max, label, color, position }) {
  const normalized = ((Number(value) - min) / (max - min)) * 2 - 1;
  const angle = normalized * Math.PI;

  return (
    <group position={position}>
      <mesh rotation={[0, 0, angle]}>
        <torusGeometry args={[0.28, 0.06, 16, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={new THREE.Color(color)}
          emissiveIntensity={0.3}
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
      <mesh rotation={[0, 0, angle]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 8]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.5} roughness={0.3} />
      </mesh>
      <Html position={[0, -0.5, 0]} center>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#94a3b8",
            whiteSpace: "nowrap",
          }}
        >
          {label} {Math.round(Number(value) || 0)}°
        </div>
      </Html>
    </group>
  );
}

function OrientationScene({ yaw = 0, pitch = 0, roll = 0 }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 2, 2]} intensity={0.8} />

      <Dial
        value={yaw}
        min={-180}
        max={180}
        label="Yaw"
        color="#38bdf8"
        position={[-0.5, 0, 0]}
      />
      <Dial
        value={pitch}
        min={-90}
        max={90}
        label="Pitch"
        color="#818cf8"
        position={[0, 0, 0]}
      />
      <Dial
        value={roll}
        min={-180}
        max={180}
        label="Roll"
        color="#fbbf24"
        position={[0.5, 0, 0]}
      />
    </>
  );
}

export default function Orientation3D({ yaw = 0, pitch = 0, roll = 0, style = {} }) {
  return (
    <div
      style={{
        width: "100%",
        height: 120,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(10, 14, 24, 0.6)",
        overflow: "hidden",
        ...style,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 1.8], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <OrientationScene yaw={yaw} pitch={pitch} roll={roll} />
      </Canvas>
    </div>
  );
}
