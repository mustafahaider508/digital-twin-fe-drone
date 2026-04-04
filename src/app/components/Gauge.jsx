"use client";

import React, { useMemo } from "react";

export default function Gauge({ label, value, min, max, unit = "" }) {
  const testId = `gauge-${label}-value`;
  const pct = useMemo(() => {
    const clamped = Math.max(min, Math.min(max, Number(value || 0)));
    return ((clamped - min) / (max - min)) * 100;
  }, [value, min, max]);

  const displayVal = Number(value || 0).toFixed(0);

  return (
    <div style={S.wrap}>
      <div style={S.label}>{label}</div>
      <div
        style={{
          ...S.ring,
          background: `conic-gradient(#38bdf8 ${pct}%, rgba(255,255,255,0.06) 0)`,
        }}
      >
        <div style={S.inner}>
          <div data-testid={testId} style={S.value}>
            {displayVal}
            <span style={S.unit}>{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  wrap: {
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
    padding: 8,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    boxShadow: "0 3px 10px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.05) inset",
    transform: "perspective(100px) rotateX(1.5deg)",
  },
  label: {
    fontSize: 9,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.08em",
  },
  ring: {
    width: "100%",
    aspectRatio: "1/1",
    borderRadius: 999,
    padding: 4,
    display: "grid",
    placeItems: "center",
  },
  inner: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    background: "rgba(12, 17, 29, 0.95)",
    border: "1px solid rgba(255,255,255,0.06)",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
  },
  value: {
    fontSize: 13,
    fontWeight: 700,
    color: "#38bdf8",
    fontVariantNumeric: "tabular-nums",
  },
  unit: {
    fontSize: 9,
    fontWeight: 600,
    color: "#64748b",
  },
};
