"use client";

import React from "react";

export default function TopBar({
  title,
  subtitle,
  status = "LIVE",
}) {
  const isLive = status === "LIVE";

  return (
    <div style={S.bar}>
      <div style={S.left}>
        <div style={S.logoMark} />
        <div>
          <div style={S.title}>{title}</div>
          {subtitle && <div style={S.subtitle}>{subtitle}</div>}
        </div>
      </div>

      <div style={S.center}>
        <div style={S.statusChip}>
          <span
            style={{
              ...S.statusDot,
              background: isLive ? "#34d399" : "#f87171",
              boxShadow: isLive
                ? "0 0 8px rgba(52,211,153,0.6)"
                : "0 0 8px rgba(248,113,113,0.6)",
            }}
          />
          <span style={{ ...S.statusText, color: isLive ? "#34d399" : "#f87171" }}>
            {status}
          </span>
        </div>
      </div>

      <div style={S.right}>
        <div style={S.timeDisplay}>
          {new Date().toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        <button style={S.iconBtn} title="Notifications">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
        </button>
        <button style={S.iconBtn} title="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

const S = {
  bar: {
    height: 46,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(12, 17, 29, 0.85)",
    backdropFilter: "blur(20px)",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    padding: "0 16px",
    gap: 12,
  },

  left: { display: "flex", alignItems: "center", gap: 10 },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)",
    boxShadow: "0 0 12px rgba(56,189,248,0.3)",
    flexShrink: 0,
  },
  title: {
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: "0.04em",
    color: "#f1f5f9",
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: 500,
    letterSpacing: "0.02em",
  },

  center: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
  },
  statusChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 8,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    display: "inline-block",
  },
  statusText: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
  },

  right: {
    display: "flex",
    gap: 6,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  timeDisplay: {
    fontSize: 11,
    fontWeight: 600,
    color: "#94a3b8",
    fontVariantNumeric: "tabular-nums",
    padding: "4px 8px",
    borderRadius: 6,
    background: "rgba(255,255,255,0.04)",
    marginRight: 4,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.04)",
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    padding: 0,
  },
};
