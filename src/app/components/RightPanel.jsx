"use client";

import React from "react";
import Gauge from "./Gauge";
import Battery3DGauge from "./Battery3DGauge";
import Orientation3D from "./Orientation3D";

export default function RightPanel({ telemetry }) {
  return (
    <div style={S.panel}>
      <div style={S.panelTitle}>Workspace</div>

      <div style={S.streamRow}>
        <span style={S.streamLabel}>Telemetry stream</span>
        <div
          style={{
            ...S.statusPill,
            color: "#34d399",
            borderColor: "rgba(52,211,153,0.25)",
            background: "rgba(52,211,153,0.08)",
          }}
          data-testid="telemetry-status"
        >
          {telemetry.status}
        </div>
      </div>

      {/* 3D Battery */}
      <div style={S.sectionLabel}>3D BATTERY</div>
      <Battery3DGauge value={telemetry?.battery ?? 82} label="Battery" />

      {/* KPI Grid */}
      <div style={S.sectionLabel}>PERFORMANCE</div>
      <div style={S.kpiGrid}>
        <KpiCard label="Altitude" value={`${telemetry.altitude} m`} color="#38bdf8" />
        <KpiCard label="Speed" value={`${telemetry.speed} km/h`} color="#818cf8" />
        <KpiCard label="Dist GCS" value={`${telemetry.distToGcs} m`} color="#94a3b8" />
        <KpiCard
          label="Flight"
          value={`${telemetry.flightTime} min`}
          color="#fbbf24"
          span2
        />
      </div>

      {/* Orientation */}
      <div style={S.sectionLabel}>ORIENTATION</div>
      <Orientation3D
        yaw={telemetry.yaw}
        pitch={telemetry.pitch}
        roll={telemetry.roll}
        style={{ marginBottom: 6 }}
      />
      <div style={S.gaugeGrid}>
        <Gauge label="Yaw" value={telemetry.yaw} min={-180} max={180} unit="°" />
        <Gauge label="Pitch" value={telemetry.pitch} min={-90} max={90} unit="°" />
        <Gauge label="Roll" value={telemetry.roll} min={-180} max={180} unit="°" />
      </div>
    </div>
  );
}

function KpiCard({ label, value, color = "#38bdf8", span2 = false }) {
  return (
    <div
      style={{
        ...S.kpi,
        ...(span2 ? { gridColumn: "span 2" } : {}),
      }}
    >
      <div style={S.kpiLabel}>{label}</div>
      <div style={{ ...S.kpiValue, color }}>{value}</div>
    </div>
  );
}

const S = {
  panel: {
    height: "100%",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(12, 17, 29, 0.85)",
    backdropFilter: "blur(20px)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    overflow: "auto",
  },

  panelTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    letterSpacing: "0.08em",
    paddingBottom: 4,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },

  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "#64748b",
  },

  streamRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
    boxShadow: "0 2px 10px rgba(0,0,0,0.22), 0 1px 0 rgba(255,255,255,0.04) inset",
  },
  streamLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "#94a3b8",
  },
  statusPill: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.1em",
    padding: "3px 8px",
    borderRadius: 6,
    border: "1px solid",
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 5,
  },
  kpi: {
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
    padding: "8px 10px",
    boxShadow: "0 3px 10px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.05) inset",
    transform: "perspective(100px) rotateX(1.5deg)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  kpiLabel: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: 600,
    letterSpacing: "0.04em",
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: 700,
    marginTop: 2,
    fontVariantNumeric: "tabular-nums",
  },

  gaugeGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 5,
  },
};
