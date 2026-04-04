"use client";

import React from "react";

export default function KpiStrip({ telemetry, syncLatencyMs = null, droneStateHz = 0, wsConnected = false }) {
  const battColor =
    telemetry.battery > 50 ? "#34d399" : telemetry.battery > 20 ? "#fbbf24" : "#f87171";

  const items = [
    {
      label: "ALT",
      value: `${telemetry.altitude}`,
      unit: "m",
      color: "#38bdf8",
      testId: "kpi-alt-value",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7"/>
        </svg>
      ),
    },
    {
      label: "SPD",
      value: `${telemetry.speed}`,
      unit: "km/h",
      color: "#818cf8",
      testId: "kpi-spd-value",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
      ),
    },
    {
      label: "BAT",
      value: `${telemetry.battery}`,
      unit: "%",
      color: battColor,
      testId: "kpi-bat-value",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="6" width="18" height="12" rx="2" ry="2"/><line x1="23" y1="13" x2="23" y2="11"/>
        </svg>
      ),
    },
    {
      label: "DIST",
      value: `${telemetry.distToGcs}`,
      unit: "m",
      color: "#94a3b8",
      testId: "kpi-dist-value",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 10-16 0c0 3 2.7 7 8 11.7z"/>
        </svg>
      ),
    },
    {
      label: "SYNC",
      value: wsConnected && syncLatencyMs != null ? `${Math.round(syncLatencyMs)}` : "—",
      unit: "ms",
      color: syncLatencyMs != null && syncLatencyMs > 500 ? "#fbbf24" : "#2dd4bf",
      testId: "kpi-sync-latency",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
      ),
    },
    {
      label: "RATE",
      value: wsConnected ? `${droneStateHz}` : "—",
      unit: "/s",
      color: "#a78bfa",
      testId: "kpi-drone-state-hz",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={S.strip}>
      {items.map((it) => (
        <div key={it.label} style={S.card}>
          <div style={{ ...S.icon, color: it.color }}>{it.icon}</div>
          <div>
            <div style={S.label}>{it.label}</div>
            <div style={S.valueRow}>
              <span data-testid={it.testId} style={{ ...S.value, color: it.color }}>
                {it.value}
              </span>
              <span style={S.unit}>{it.unit}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const S = {
  strip: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 6,
    pointerEvents: "auto",
  },
  card: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    borderTop: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(10, 14, 24, 0.78)",
    backdropFilter: "blur(16px)",
    padding: "8px 10px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.06) inset",
    transform: "perspective(120px) rotateX(2deg)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    background: "rgba(255,255,255,0.05)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  label: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "#64748b",
    lineHeight: 1,
  },
  valueRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 2,
    marginTop: 2,
  },
  value: {
    fontSize: 15,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
  },
  unit: {
    fontSize: 9,
    fontWeight: 600,
    color: "#64748b",
  },
};
