"use client";

import React, { useMemo } from "react";

/**
 * Tenant picker styled for the drone dashboard glass panels (TopBar / KPI / sidebar theme).
 * Green dot + ACTIVE label match live / ONLINE indicators (#34d399).
 */
export default function TenantSelectControl({ tenantId, tenantOptions, onTenantChange }) {
  const options = useMemo(() => {
    const list = Array.isArray(tenantOptions) ? tenantOptions : [];
    const merged = [...new Set([...(list || []), tenantId].filter(Boolean).map(String))];
    merged.sort((a, b) => a.localeCompare(b));
    return merged;
  }, [tenantOptions, tenantId]);

  if (typeof onTenantChange !== "function") return null;

  return (
    <div style={S.wrap}>
      <div style={S.shell} className="dt-tenant-shell">
        <div style={S.leftRail}>
          <span style={S.activeDot} title="Active tenant scope" aria-hidden />
          <span style={S.activeLabel}>ACTIVE</span>
        </div>
        <select
          className="dt-tenant-select"
          value={tenantId}
          onChange={(e) => onTenantChange(e.target.value)}
          style={S.select}
          aria-label="Select tenant"
        >
          {options.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div style={S.chevron} aria-hidden>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748b"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </div>

      {/* <div style={S.customRow}>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Add tenant…"
          style={S.customInput}
          aria-label="Add tenant id"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const next = custom.trim();
            if (!/^[\\w.-]{1,64}$/.test(next)) return;
            onTenantChange(next);
            setCustom("");
          }}
        />
        <button
          type="button"
          style={{
            ...S.customBtn,
            opacity: canUseCustom ? 1 : 0.5,
            cursor: canUseCustom ? "pointer" : "not-allowed",
          }}
          disabled={!canUseCustom}
          onClick={() => {
            const next = custom.trim();
            if (!/^[\\w.-]{1,64}$/.test(next)) return;
            onTenantChange(next);
            setCustom("");
          }}
        >
          Use
        </button>
      </div> */}
    </div>
  );
}

const S = {
  wrap: { display: "flex", flexDirection: "column", gap: 6 },
  shell: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    minHeight: 42,
    padding: "8px 10px 8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    borderTop: "1px solid rgba(255,255,255,0.12)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.025) 100%)",
    boxShadow: "0 3px 12px rgba(0,0,0,0.28), 0 1px 0 rgba(255,255,255,0.06) inset",
  },
  leftRail: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    flexShrink: 0,
    paddingRight: 2,
    borderRight: "1px solid rgba(255,255,255,0.08)",
    marginRight: 2,
    minWidth: 44,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#34d399",
    boxShadow: "0 0 10px rgba(52,211,153,0.65), 0 0 3px rgba(52,211,153,0.9)",
  },
  activeLabel: {
    fontSize: 7,
    fontWeight: 800,
    letterSpacing: "0.14em",
    color: "#34d399",
    lineHeight: 1,
  },
  select: {
    flex: 1,
    minWidth: 0,
    margin: 0,
    padding: "4px 6px",
    border: "none",
    background: "transparent",
    color: "#f1f5f9",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.02em",
    cursor: "pointer",
    outline: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    appearance: "none",
  },
  chevron: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    opacity: 0.85,
    pointerEvents: "none",
  },

  customRow: { display: "flex", alignItems: "center", gap: 6 },
  customInput: {
    flex: 1,
    minWidth: 0,
    height: 34,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#e2e8f0",
    padding: "0 10px",
    fontSize: 11,
    fontWeight: 600,
    outline: "none",
  },
  customBtn: {
    height: 34,
    padding: "0 10px",
    borderRadius: 10,
    border: "1px solid rgba(56,189,248,0.35)",
    background: "rgba(56,189,248,0.12)",
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.02em",
  },
};
