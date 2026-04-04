"use client";

import React, { useMemo, useState, useEffect } from "react";

// Deterministic placeholder path for SSR and initial hydration (avoids hydration mismatch)
const PLACEHOLDER_POINTS = Object.freeze(
  Array.from({ length: 28 }, (_, i) => {
    const wobble = Math.sin(i / 3) * 8 + Math.cos(i / 5) * 6;
    return 80 + wobble;
  })
);

function buildPathD(points) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  return points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 100 - ((v - min) / (max - min || 1)) * 100;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

const PLACEHOLDER_D = buildPathD(PLACEHOLDER_POINTS);

export default function TelemetryTimeline({ telemetry }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const points = useMemo(() => {
    if (!mounted) return PLACEHOLDER_POINTS;
    const base = telemetry?.altitude ?? 80;
    return Array.from({ length: 28 }).map((_, i) => {
      const wobble = Math.sin(i / 3) * 8 + Math.cos(i / 5) * 6;
      return base + wobble;
    });
  }, [mounted, telemetry?.altitude]);

  const d = mounted ? buildPathD(points) : PLACEHOLDER_D;

  return (
    <div style={S.wrap}>
      <div style={S.top}>
        <MiniKpi label="ALT" value={`${telemetry?.altitude ?? "—"}`} unit="m" color="#38bdf8" />
        <MiniKpi label="SPD" value={`${telemetry?.speed ?? "—"}`} unit="km/h" color="#818cf8" />
        <MiniKpi label="BAT" value={`${telemetry?.battery ?? "—"}`} unit="%" color="#34d399" />
      </div>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={S.svg}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L 100 100 L 0 100 Z`} fill="url(#lineGrad)" />
        <path d={d} fill="none" stroke="#38bdf8" strokeWidth="2" />
      </svg>
    </div>
  );
}

function MiniKpi({ label, value, unit, color }) {
  return (
    <div style={S.mini}>
      <div style={S.miniLabel}>{label}</div>
      <div style={S.miniValueRow}>
        <span style={{ ...S.miniValue, color }}>{value}</span>
        <span style={S.miniUnit}>{unit}</span>
      </div>
    </div>
  );
}

const S = {
  wrap: {
    height: "100%",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(10, 14, 24, 0.6)",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    boxShadow: "0 3px 10px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.04) inset",
    transform: "perspective(100px) rotateX(1deg)",
  },
  top: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 5,
    padding: 8,
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  mini: {
    borderRadius: 6,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
    padding: "5px 6px",
  },
  miniLabel: {
    fontSize: 8,
    color: "#64748b",
    fontWeight: 700,
    letterSpacing: "0.1em",
    lineHeight: 1,
  },
  miniValueRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 2,
    marginTop: 3,
  },
  miniValue: {
    fontSize: 12,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
  },
  miniUnit: {
    fontSize: 8,
    fontWeight: 600,
    color: "#64748b",
  },
  svg: { width: "100%", height: "100%" },
};
