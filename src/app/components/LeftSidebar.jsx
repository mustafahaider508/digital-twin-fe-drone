"use client";

import React from "react";
import TenantSelectControl from "./TenantSelectControl";

function Section({ label, children }) {
  return (
    <div style={S.section}>
      <div style={S.sectionLabel}>{label}</div>
      {children}
    </div>
  );
}

export default function LeftSidebar({
  tenantId,
  tenantPresets = [],
  onTenantChange,
  conn,
  followDrone,
  setFollowDrone,
  autoCenter,
  setAutoCenter,
  showTrail,
  setShowTrail,
  cameraMode,
  setCameraMode,
}) {
  const tenantOptions = [...new Set([...(tenantPresets || []), tenantId].filter(Boolean))];
  const canPickTenant = typeof onTenantChange === "function";

  return (
    <div style={S.panel}>
      <div style={S.panelTitle}>Fleet</div>

      {canPickTenant ? (
        <Section label="TENANT">
          <TenantSelectControl
            tenantId={tenantId}
            tenantOptions={tenantOptions}
            onTenantChange={onTenantChange}
          />
        </Section>
      ) : null}

      <Section label="LINK STATUS">
        <ConnRow label="Telemetry" ok={conn.mqtt} />
        <ConnRow label="Video Feed" ok={conn.cam} />
      </Section>

      <Section label="MAP CONTROLS">
        <Toggle label="Follow drone" value={followDrone} onChange={setFollowDrone} />
        <Toggle label="Auto-center" value={autoCenter} onChange={setAutoCenter} />
        <Toggle label="Show trail" value={showTrail} onChange={setShowTrail} />
      </Section>

      <Section label="VIEW MODE">
        <div style={S.chipGroup}>
          <Chip label="FPV" active={cameraMode === "FPV"} onClick={() => setCameraMode("FPV")} />
          <Chip
            label="Map + FPV"
            active={cameraMode === "Map+FPV"}
            onClick={() => setCameraMode("Map+FPV")}
          />
        </div>
      </Section>
    </div>
  );
}

function ConnRow({ label, ok }) {
  return (
    <div style={S.connRow}>
      <span style={S.connLabel}>{label}</span>
      <span
        style={{
          ...S.connBadge,
          color: ok ? "#34d399" : "#f87171",
          borderColor: ok ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)",
          background: ok
            ? "rgba(52,211,153,0.08)"
            : "rgba(248,113,113,0.08)",
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: ok ? "#34d399" : "#f87171",
            display: "inline-block",
          }}
        />
        {ok ? "ONLINE" : "OFFLINE"}
      </span>
    </div>
  );
}

function Toggle({ label, value, onChange }) {
  return (
    <div style={S.toggleRow}>
      <span style={S.toggleLabel}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          ...S.track,
          background: value ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.06)",
          borderColor: value ? "rgba(56,189,248,0.4)" : "rgba(255,255,255,0.1)",
        }}
      >
        <span
          style={{
            ...S.thumb,
            transform: value ? "translateX(16px)" : "translateX(0)",
            background: value ? "#38bdf8" : "#64748b",
          }}
        />
      </button>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...S.chip,
        background: active ? "rgba(56,189,248,0.12)" : "rgba(255,255,255,0.03)",
        borderColor: active ? "rgba(56,189,248,0.35)" : "rgba(255,255,255,0.08)",
        color: active ? "#38bdf8" : "#94a3b8",
      }}
    >
      {label}
    </button>
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

  section: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.12em",
    color: "#64748b",
  },

  connRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "3px 0",
  },
  connLabel: { fontSize: 10, color: "#94a3b8", fontWeight: 600 },
  connBadge: {
    padding: "3px 8px",
    borderRadius: 6,
    border: "1px solid",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.06em",
    display: "flex",
    alignItems: "center",
    gap: 5,
  },

  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "3px 0",
  },
  toggleLabel: { fontSize: 10, color: "#cbd5e1", fontWeight: 600 },
  track: {
    width: 34,
    height: 18,
    borderRadius: 999,
    border: "1px solid",
    padding: 2,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    transition: "background 150ms, border-color 150ms",
  },
  thumb: {
    width: 12,
    height: 12,
    borderRadius: 999,
    transition: "transform 180ms ease, background 150ms",
    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
  },

  chipGroup: { display: "flex", gap: 5, flexWrap: "wrap" },
  chip: {
    padding: "5px 10px",
    borderRadius: 6,
    border: "1px solid",
    fontWeight: 700,
    fontSize: 10,
    cursor: "pointer",
    transition: "background 150ms, border-color 150ms, color 150ms",
    letterSpacing: "0.02em",
  },
};
