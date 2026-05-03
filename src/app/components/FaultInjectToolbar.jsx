"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { tenantHeaders, useTenant } from "@/app/providers/TenantProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5555";

const SHOW =
  process.env.NEXT_PUBLIC_SIMULATOR_CONTROLS === "true";

function btnStyle(accent) {
  return {
    padding: "4px 8px",
    borderRadius: 6,
    border: `1px solid ${accent}55`,
    background: `${accent}18`,
    color: "#e2e8f0",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: "0.03em",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

export default function FaultInjectToolbar() {
  const { tenantId } = useTenant();
  const [status, setStatus] = useState("");
  const [auto, setAuto] = useState(false);
  const busy = useRef(false);

  const inject = useCallback(async (overrides) => {
    if (busy.current) return;
    busy.current = true;
    const deviceId = overrides.deviceId ?? `uc8-demo-${Date.now()}`;
    const body = {
      deviceId,
      layer: "UC8",
      timestamp: new Date().toISOString(),
      ...overrides,
      tenantId,
    };
    try {
      const r = await fetch(`${API_BASE}/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...tenantHeaders(tenantId),
        },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setStatus(`Sent · ${body.status || (body.congestion ? "congestion" : "ok")}`);
      else setStatus(j.error || `HTTP ${r.status}`);
    } catch {
      setStatus("Request failed — is the simulator on?");
    } finally {
      busy.current = false;
    }
  }, [tenantId]);

  useEffect(() => {
    if (!auto) return;
    const scenarios = [
      () => inject({ status: "warn" }),
      () => inject({ status: "error" }),
      () => inject({ status: "ok", congestion: true }),
    ];
    const id = setInterval(() => {
      scenarios[Math.floor(Math.random() * scenarios.length)]();
    }, 12000);
    return () => clearInterval(id);
  }, [auto, inject, tenantId]);

  if (!SHOW) return null;

  return (
    <div style={S.wrap}>
      <div style={S.row}>
        <span style={S.label}>UC8 fault sim</span>
        <button type="button" style={btnStyle("#fbbf24")} onClick={() => inject({ status: "warn" })}>
          Warn
        </button>
        <button type="button" style={btnStyle("#f87171")} onClick={() => inject({ status: "error" })}>
          Error
        </button>
        <button type="button" style={btnStyle("#a78bfa")} onClick={() => inject({ status: "ok", congestion: true })}>
          Congestion
        </button>
      </div>
      <div style={S.row}>
        <label style={S.toggle}>
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
          />
          Auto every 12s
        </label>
        {status ? <span style={S.status}>{status}</span> : null}
      </div>
    </div>
  );
}

const S = {
  wrap: {
    padding: "0 8px 6px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    marginBottom: 4,
  },
  row: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginRight: 4,
  },
  toggle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 9,
    fontWeight: 600,
    color: "#94a3b8",
    cursor: "pointer",
    userSelect: "none",
  },
  status: {
    fontSize: 9,
    fontWeight: 600,
    color: "#38bdf8",
    fontFamily: "monospace",
    marginLeft: "auto",
  },
};
