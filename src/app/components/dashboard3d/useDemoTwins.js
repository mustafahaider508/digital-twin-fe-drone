"use client";

import { useEffect, useMemo, useState } from "react";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const map01 = (v, min, max) => (max === min ? 0 : clamp((v - min) / (max - min), 0, 1));

function wave(t, min, max, noise = 0.08) {
  const mid = (min + max) / 2;
  const amp = (max - min) / 2;
  const base = mid + amp * Math.sin(t);
  const jitter = (Math.random() * 2 - 1) * amp * noise;
  return clamp(base + jitter, min, max);
}

function calcHealth({ latency, packetLoss, cpu, offline }) {
  if (offline) return "offline";
  if (packetLoss > 3 || latency > 160 || cpu > 85) return "critical";
  if (packetLoss > 1.5 || latency > 90 || cpu > 65) return "warn";
  return "ok";
}

export function useDemoTwins() {
  // 5 twins (fixed 3D positions for MVP)
  const topology = useMemo(() => {
    const nodes = [
      { id: "twin-01", label: "EDGE-01", pos: [-1.6, 0.4, 0.6] },
      { id: "twin-02", label: "EDGE-02", pos: [0.0, 0.8, 1.2] },
      { id: "twin-03", label: "CORE-01", pos: [1.6, 0.4, 0.6] },
      { id: "twin-04", label: "IOT-01", pos: [-0.9, 0.2, -1.2] },
      { id: "twin-05", label: "IOT-02", pos: [0.9, 0.2, -1.2] },
    ];

    // simple demo network
    const edges = [
      { from: "twin-01", to: "twin-02" },
      { from: "twin-02", to: "twin-03" },
      { from: "twin-02", to: "twin-04" },
      { from: "twin-02", to: "twin-05" },
      { from: "twin-04", to: "twin-05" },
    ];

    return { nodes, edges };
  }, []);

  // Latest telemetry per twin
  const [latest, setLatest] = useState(() => {
    const init = {};
    for (const n of topology.nodes) {
      init[n.id] = {
        twinId: n.id,
        temperature: 24.0,
        cpu: 20,
        latency: 30,
        packetLoss: 0.2,
        battery: 100,
        offline: false,
        ts: new Date().toISOString(),
      };
    }
    return init;
  });

  // History (for chart) - keep last 60 points per twin (cpu)
  const [history, setHistory] = useState(() => {
    const init = {};
    for (const n of topology.nodes) init[n.id] = [];
    return init;
  });

  useEffect(() => {
    let tick = 0;

    const id = setInterval(() => {
      tick += 0.18;

      setLatest((prev) => {
        const next = { ...prev };

        for (const twinId of Object.keys(next)) {
          // simulate occasional offline in demo (very low chance)
          const offlineFlip = Math.random() < 0.015;
          const offline = offlineFlip ? !next[twinId].offline : next[twinId].offline;

          const temperature = +wave(tick * 0.8 + Math.random(), 18, 38, 0.10).toFixed(2);
          const cpu = +wave(tick * 1.1 + Math.random(), 5, 95, 0.12).toFixed(2);
          const latency = +wave(tick * 0.9 + Math.random(), 5, 220, 0.16).toFixed(2);
          const packetLoss = +wave(tick * 1.5 + Math.random(), 0, 6, 0.22).toFixed(2);

          let battery = next[twinId].battery - 0.08;
          if (battery <= 10) battery = 100;

          next[twinId] = {
            ...next[twinId],
            temperature,
            cpu,
            latency,
            packetLoss,
            battery: +battery.toFixed(2),
            offline,
            ts: new Date().toISOString(),
          };
        }

        return next;
      });

      setHistory((prev) => {
        const out = { ...prev };
        for (const twinId of Object.keys(out)) {
          const point = {
            t: new Date().toLocaleTimeString(),
            cpu: latest?.[twinId]?.cpu ?? 0,
          };
          const arr = [...out[twinId], point];
          out[twinId] = arr.length > 60 ? arr.slice(arr.length - 60) : arr;
        }
        return out;
      });
    }, 1000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build view-model nodes with health
  const nodesVM = useMemo(() => {
    return topology.nodes.map((n) => {
      const t = latest[n.id];
      const health = calcHealth(t);
      return { ...n, telemetry: t, health };
    });
  }, [topology.nodes, latest]);

  // Edge health based on “to/from” latency average
  const edgesVM = useMemo(() => {
    return topology.edges.map((e) => {
      const a = latest[e.from]?.latency ?? 0;
      const b = latest[e.to]?.latency ?? 0;
      const latency = (a + b) / 2;
      const loss = (latest[e.from]?.packetLoss ?? 0 + (latest[e.to]?.packetLoss ?? 0)) / 2;
      const heat = map01(latency, 5, 220); // 0..1
      return { ...e, latency, loss, heat };
    });
  }, [topology.edges, latest]);

  return { nodesVM, edgesVM, latest, history };
}
