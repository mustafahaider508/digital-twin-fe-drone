"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";

function Line3D({ points, color }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    g.computeBoundingSphere();
    return g;
  }, [points]);

  return (
    <line geometry={geom}>
      <lineBasicMaterial color={color} />
    </line>
  );
}

function ChartScene({ battery = [], altitude = [], speed = [] }) {
  const scale = useMemo(() => {
    const all = [...battery, ...altitude, ...speed].map((d) => d.v);
    const min = Math.min(...all, 0);
    const max = Math.max(...all, 100);
    const range = max - min || 1;
    return { min, max, range };
  }, [battery, altitude, speed]);

  const toX = (i, n) => (n <= 1 ? 0 : (i / (n - 1)) * 2 - 1);
  const toY = (v) => ((v - scale.min) / scale.range) * 1.6 - 0.8;

  const battPoints = useMemo(
    () =>
      battery.map((d, i) => new THREE.Vector3(toX(i, battery.length), toY(d.v), 0)),
    [battery, scale.range, scale.min]
  );
  const altPoints = useMemo(
    () =>
      altitude.map((d, i) => new THREE.Vector3(toX(i, altitude.length), toY(d.v), -0.15)),
    [altitude, scale.range, scale.min]
  );
  const spdPoints = useMemo(
    () =>
      speed.map((d, i) => new THREE.Vector3(toX(i, speed.length), toY(d.v), 0.15)),
    [speed, scale.range, scale.min]
  );

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 2, 2]} intensity={0.8} />

      <group position={[0, 0, 0]} scale={[0.9, 0.9, 0.9]}>
        {battPoints.length >= 2 && <Line3D points={battPoints} color="#34d399" />}
        {altPoints.length >= 2 && <Line3D points={altPoints} color="#38bdf8" />}
        {spdPoints.length >= 2 && <Line3D points={spdPoints} color="#818cf8" />}
      </group>
    </>
  );
}

export default function Telemetry3DChart({ telemetryHistory = {}, style = {} }) {
  const battery = telemetryHistory.battery ?? [];
  const altitude = telemetryHistory.altitude ?? [];
  const speed = telemetryHistory.speed ?? [];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 140,
        borderRadius: 8,
        overflow: "hidden",
        background: "rgba(10, 14, 24, 0.6)",
        ...style,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <ChartScene battery={battery} altitude={altitude} speed={speed} />
      </Canvas>
      <div
        style={{
          position: "absolute",
          bottom: 4,
          left: 6,
          display: "flex",
          gap: 10,
          fontSize: 9,
          fontWeight: 700,
          color: "#64748b",
        }}
      >
        <span style={{ color: "#34d399" }}>BAT</span>
        <span style={{ color: "#38bdf8" }}>ALT</span>
        <span style={{ color: "#818cf8" }}>SPD</span>
      </div>
    </div>
  );
}
