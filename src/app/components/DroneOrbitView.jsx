"use client";

import React, { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";

/**
 * Spinning propeller (used if GLB has no motors, or we add extra)
 */
function Propeller({ position, speed = 22 }) {
  const group = useRef();
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * speed;
  });
  return (
    <group ref={group} position={position}>
      <mesh>
        <cylinderGeometry args={[0.1, 0.1, 0.06, 24]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.65, 0.02, 0.08]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.65, 0.02, 0.08]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.35} metalness={0.15} />
      </mesh>
    </group>
  );
}

/**
 * Drone GLB with optional procedural propellers; normalizes scale and centers
 */
function DroneModel() {
  const group = useRef();
  const { scene } = useGLTF("/models/drone.glb");
  const cloned = useMemo(() => {
    const s = scene.clone();
    s.traverse((o) => {
      if (o.isMesh) o.frustumCulled = false;
    });
    const box = new THREE.Box3().setFromObject(s);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    let scale = 1;
    if (maxDim > 1000) scale = 0.001;
    else if (maxDim > 100) scale = 0.01;
    else if (maxDim > 10) scale = 0.1;
    s.scale.setScalar(scale);
    s.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(s);
    box2.getCenter(center);
    s.position.sub(center);
    return s;
  }, [scene]);

  // Subtle hover
  useFrame((state) => {
    if (group.current) {
      const t = state.clock.getElapsedTime();
      group.current.position.y = Math.sin(t * 1.2) * 0.04;
    }
  });

  const box = useMemo(() => {
    const b = new THREE.Box3().setFromObject(cloned);
    const s = new THREE.Vector3();
    b.getSize(s);
    return s;
  }, [cloned]);

  const rx = box.x * 0.42;
  const rz = box.z * 0.42;
  const ry = -box.y / 2 + box.y * 0.3;
  const propPositions = [
    [rx, ry + 0.02, rz],
    [-rx, ry + 0.02, rz],
    [rx, ry + 0.02, -rz],
    [-rx, ry + 0.02, -rz],
  ];

  return (
    <group ref={group}>
      <primitive object={cloned} />
      {propPositions.map((p, i) => (
        <Propeller key={i} position={p} speed={22} />
      ))}
    </group>
  );
}

function FallbackDrone() {
  const group = useRef();
  useFrame((state) => {
    if (group.current)
      group.current.position.y = Math.sin(state.clock.getElapsedTime() * 1.2) * 0.04;
  });
  return (
    <group ref={group}>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.9, 0.18, 0.6]} />
        <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.2} />
      </mesh>
      <Propeller position={[0.5, 0.4, 0.4]} />
      <Propeller position={[-0.5, 0.4, 0.4]} />
      <Propeller position={[0.5, 0.4, -0.4]} />
      <Propeller position={[-0.5, 0.4, -0.4]} />
    </group>
  );
}

export default function DroneOrbitView({ style = {} }) {
  return (
    <div
      style={{
        width: "100%",
        height: "80vh",
        minHeight: 400,
        position: "relative",
        ...style,
      }}
    >
      <Canvas
        camera={{ position: [2.5, 1.2, 2.5], fov: 50 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} />
        <directionalLight position={[-3, 3, -2]} intensity={0.4} />
        <Environment preset="city" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.05} />
        </mesh>

        <Suspense fallback={<FallbackDrone />}>
          <DroneModel />
        </Suspense>

        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={0.8}
          maxDistance={12}
          maxPolarAngle={Math.PI / 2 - 0.1}
        />
      </Canvas>
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 12,
          color: "rgba(255,255,255,0.8)",
          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          pointerEvents: "none",
        }}
      >
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  );
}
