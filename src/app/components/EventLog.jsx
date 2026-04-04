"use client";

import React from "react";

const levelColors = {
  info: "#38bdf8",
  success: "#34d399",
  warning: "#fbbf24",
  error: "#f87171",
};

export default function EventLog({ events = [] }) {
  return (
    <div style={S.wrap}>
      {events.length === 0 ? (
        <div style={S.empty}>No events recorded</div>
      ) : (
        <div style={S.list}>
          {events.map((e, idx) => {
            const color = levelColors[e.level] || "#94a3b8";
            const key = e.id != null ? String(e.id) : `row-${idx}`;
            return (
              <div key={key} style={S.row}>
                <span
                  style={{
                    ...S.dot,
                    background: color,
                    boxShadow: `0 0 4px ${color}40`,
                  }}
                />
                <span style={S.ts}>{e.ts}</span>
                <span style={S.msg}>{e.msg}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const S = {
  wrap: {
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(10, 14, 24, 0.6)",
    padding: 8,
    maxHeight: 120,
    overflow: "auto",
  },
  empty: { color: "#475569", fontSize: 10, fontWeight: 600 },
  list: { display: "flex", flexDirection: "column", gap: 5 },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingBottom: 5,
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    flexShrink: 0,
  },
  ts: {
    fontSize: 10,
    fontWeight: 600,
    color: "#64748b",
    fontVariantNumeric: "tabular-nums",
    fontFamily: "monospace",
    flexShrink: 0,
  },
  msg: {
    fontSize: 10,
    fontWeight: 600,
    color: "#cbd5e1",
  },
};
