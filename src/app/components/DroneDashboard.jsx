"use client";

import React, { useMemo, useState, useEffect } from "react";
import DroneMap from "@/app/components/DroneMap";
import useDroneTelemetry from "@/app/hooks/useDroneTelemetry";

import TopBar from "./TopBar";
import LeftSidebar from "./LeftSidebar";
import RightPanel from "./RightPanel";
import KpiStrip from "./KpiStrip";
import BottomSection from "./BottomSection";
import CameraFeed from "./CameraFeed";
import { PRESETS, tenantHeaders, useTenant } from "@/app/providers/TenantProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5555";

/** Set NEXT_PUBLIC_DEBUG_DRONE_TELEMETRY=1 in .env.local — shows merged backend `drone_state` (segmentation output). */
const SHOW_BACKEND_MERGE_PANEL =
  process.env.NEXT_PUBLIC_DEBUG_DRONE_TELEMETRY === "1" ||
  process.env.NEXT_PUBLIC_DEBUG_DRONE_TELEMETRY === "true";

/** Map simulator / WS anomaly payload to EventLog row ({ id, ts, msg, level }). */
function formatAnomalyForLog(e) {
  if (!e || typeof e !== "object") return null;
  const id = e.id ?? `evt-${e.timestamp}-${e.deviceId ?? "?"}`;
  const tsRaw = e.timestamp ?? e.ts;
  let ts = "—";
  let sortTime = 0;
  if (tsRaw) {
    const parsed = new Date(tsRaw);
    const ms = parsed.getTime();
    sortTime = Number.isNaN(ms) ? 0 : ms;
    ts = Number.isNaN(ms)
      ? String(tsRaw)
      : parsed.toLocaleTimeString(undefined, {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
  }
  const sev = String(e.severity ?? e.level ?? "").toLowerCase();
  let level = "info";
  if (sev === "error") level = "error";
  else if (sev === "warn" || sev === "warning") level = "warning";
  else if (sev === "ok" || sev === "success") level = "success";
  const msg =
    e.message ||
    e.msg ||
    (e.deviceId ? `Anomaly · ${e.deviceId}` : "Anomaly detected");
  const layer = e.layer && e.layer !== "unknown" ? ` · ${e.layer}` : "";
  return { id, ts, msg: `${msg}${layer}`, level, _sortTime: sortTime };
}

export default function DroneDashboard() {
  const { tenantId, setTenantId } = useTenant();

  const telemetryWsUrl = useMemo(() => {
    const base = API_BASE.replace(/^http/, "ws").replace(/\/?$/, "") + "/ws";
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}tenantId=${encodeURIComponent(tenantId)}`;
  }, [tenantId]);

  /** Raw JPEG frames only — must not be the merged JSON telemetry `/ws`. */
  const cameraWsUrl = useMemo(() => {
    if (process.env.NEXT_PUBLIC_CAMERA_WS_URL) {
      return process.env.NEXT_PUBLIC_CAMERA_WS_URL;
    }
    const wsOrigin = API_BASE.replace(/^http/, "ws").replace(/\/?$/, "");
    const droneId = process.env.NEXT_PUBLIC_CAMERA_DRONE_ID || "drone-01";
    return `${wsOrigin}/stream?role=viewer&droneId=${encodeURIComponent(droneId)}`;
  }, []);

  const [followDrone, setFollowDrone] = useState(true);
  const [autoCenter, setAutoCenter] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  const [cameraMode, setCameraMode] = useState("Map+FPV");
  const [camConnected, setCamConnected] = useState(false);
  const [tenantOptions, setTenantOptions] = useState([]);

  const {
    telemetry,
    connected,
    droneState,
    events: wsAnomalyEvents,
    syncLatencyMs,
    droneStateHz,
  } = useDroneTelemetry(telemetryWsUrl);

  const [restEvents, setRestEvents] = useState([]);

  // Optional: discover tenants dynamically from backend; fallback to env presets.
  useEffect(() => {
    let cancelled = false;
    const parseTenants = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data.map((t) => (typeof t === "string" ? t : t?.id)).filter(Boolean);
      if (Array.isArray(data.items)) return data.items.map((t) => (typeof t === "string" ? t : t?.id)).filter(Boolean);
      if (Array.isArray(data.tenants)) return data.tenants.map((t) => (typeof t === "string" ? t : t?.id)).filter(Boolean);
      return [];
    };

    fetch(`${API_BASE}/tenants`, { cache: "no-store", headers: tenantHeaders(tenantId) })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list = parseTenants(data);
        setTenantOptions(list);
      })
      .catch(() => {
        if (!cancelled) setTenantOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const mergedBackendPayload = useMemo(() => {
    if (!droneState || typeof droneState !== "object") return null;
    const p = droneState.payload;
    return p && typeof p === "object" ? p : droneState;
  }, [droneState]);


  console.log("droneState++++++++",droneState);

  // Load anomalies from REST on a schedule — does not depend on WS (fixes empty log when WS
  // connects late, drops anomaly frames, or backend only persists to store.events).
  useEffect(() => {
    let cancelled = false;
    const loadEvents = () => {
      fetch(`${API_BASE}/events?limit=50`, {
        cache: "no-store",
        headers: tenantHeaders(tenantId),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data || !Array.isArray(data.items)) return;
          setRestEvents(data.items);
        })
        .catch(() => {});
    };
    loadEvents();
    const interval = setInterval(loadEvents, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tenantId]);

  const eventLogRows = useMemo(() => {
    const byId = new Map();
    for (const e of restEvents) {
      const row = formatAnomalyForLog(e);
      if (row) byId.set(row.id, row);
    }
    for (const e of wsAnomalyEvents) {
      const row = formatAnomalyForLog(e);
      if (row) byId.set(row.id, row);
    }
    return Array.from(byId.values())
      .sort((a, b) => b._sortTime - a._sortTime || String(b.id).localeCompare(String(a.id)))
      .slice(0, 50);
  }, [restEvents, wsAnomalyEvents]);

  const activeDroneId = useMemo(() => {
    const raw = mergedBackendPayload;
    const id = raw?.droneId ?? raw?.deviceId;
    return id ? String(id) : null;
  }, [mergedBackendPayload]);

  const conn = useMemo(
    () => ({
      mqtt: Boolean(connected),
      cam: Boolean(camConnected),
    }),
    [connected, camConnected]
  );

  const HISTORY_LEN = 60;
  const [telemetryHistory, setTelemetryHistory] = useState(() => {
    const base = { battery: 82, altitude: 80, speed: 64 };
    return {
      battery: Array.from({ length: HISTORY_LEN }, (_, i) => ({
        t: i,
        v: base.battery + Math.sin(i / 5) * 6 + (i < 10 ? 0 : (i - HISTORY_LEN) * 0.1),
      })),
      altitude: Array.from({ length: HISTORY_LEN }, (_, i) => ({
        t: i,
        v: base.altitude + Math.sin(i / 4) * 8 + Math.cos(i / 7) * 5,
      })),
      speed: Array.from({ length: HISTORY_LEN }, (_, i) => ({
        t: i,
        v: base.speed + Math.sin(i / 6) * 10,
      })),
    };
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetryHistory((prev) => {
        const push = (arr, value) => {
          const next = [...arr.slice(1), { t: arr[arr.length - 1]?.t + 1 ?? 0, v: value }];
          return next.length > HISTORY_LEN ? next.slice(-HISTORY_LEN) : next;
        };
        return {
          battery: push(prev.battery, telemetry.battery + (Math.random() - 0.5) * 4),
          altitude: push(prev.altitude, telemetry.altitude + (Math.random() - 0.5) * 6),
          speed: push(prev.speed, telemetry.speed + (Math.random() - 0.5) * 4),
        };
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [telemetry.battery, telemetry.altitude, telemetry.speed]);

  return (
    <div style={styles.page}>
      <div style={styles.topBarWrap}>
        <TopBar title="Digital Twin" subtitle="Drone Operations Center" status={telemetry.status} />
      </div>

      <div style={styles.mainGrid}>
        {/* LEFT */}
        <LeftSidebar
          tenantId={tenantId}
          tenantPresets={tenantOptions.length ? tenantOptions : PRESETS}
          onTenantChange={setTenantId}
          conn={conn}
          activeDroneId={activeDroneId}
          followDrone={followDrone}
          setFollowDrone={setFollowDrone}
          autoCenter={autoCenter}
          setAutoCenter={setAutoCenter}
          showTrail={showTrail}
          setShowTrail={setShowTrail}
          cameraMode={cameraMode}
          setCameraMode={setCameraMode}
        />

        {/* CENTER */}
        <div style={styles.centerCol}>
          <div style={styles.mapCard}>
            <div style={styles.mapHeader}>
              <div style={styles.mapTitle}>{cameraMode === "FPV" ? "FPV" : "MAP + 3D DRONE"}</div>
              <div style={styles.mapSub}>
                {cameraMode === "FPV"
                  ? "Live camera stream • low-latency WebSocket JPEG frames"
                  : "MapLibre centered on lat/lon • GLB overlay • yaw/pitch/roll rotation"}
              </div>
            </div>

            <div style={styles.mapBody}>
              <div style={styles.droneMapRoot}>
                {cameraMode === "FPV" ? (
                  <CameraFeed
                    enabled={true}
                    wsUrl={cameraWsUrl}
                    onConnectionChange={setCamConnected}
                  />
                ) : (
                  <DroneMap
                    wsUrl={telemetryWsUrl}
                    followDrone={followDrone}
                    autoCenter={autoCenter}
                    showTrail={showTrail}
                  />
                )}
              </div>
            </div>

            <div style={styles.kpiStripWrap}>
              <KpiStrip
                telemetry={telemetry}
                syncLatencyMs={syncLatencyMs}
                droneStateHz={droneStateHz}
                wsConnected={connected}
              />
            </div>

            {SHOW_BACKEND_MERGE_PANEL && (
              <div style={styles.mergeDebugPanel} aria-label="Merged drone_state from backend">
                <div style={styles.mergeDebugTitle}>Backend merged drone_state (segmentation)</div>
                <p style={styles.mergeDebugHint}>
                  KPI strip uses the same data, mapped to telemetry. Fields below are the raw WebSocket
                  payload after the server merges MQTT segments.
                </p>
                {!mergedBackendPayload ? (
                  <pre style={styles.mergeDebugPre}>No droneState yet (check WS URL / simulator).</pre>
                ) : (
                  <pre style={styles.mergeDebugPre}>
                    {JSON.stringify(
                      {
                        schemaVersion: mergedBackendPayload.schemaVersion ?? null,
                        droneId: mergedBackendPayload.droneId,
                        lat: mergedBackendPayload.lat,
                        lon: mergedBackendPayload.lon,
                        alt: mergedBackendPayload.alt,
                        battery: mergedBackendPayload.battery,
                        speed: mergedBackendPayload.speed,
                        yaw: mergedBackendPayload.yaw,
                        pitch: mergedBackendPayload.pitch,
                        roll: mergedBackendPayload.roll,
                        dist_gcs: mergedBackendPayload.dist_gcs,
                        flight_time_left: mergedBackendPayload.flight_time_left,
                        ts: mergedBackendPayload.ts,
                        units: mergedBackendPayload.units,
                      },
                      null,
                      2
                    )}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={styles.rightCol}>
          <RightPanel telemetry={telemetry} />
        </div>
      </div>

      <div style={styles.bottomWrap}>
        <BottomSection
          cameraMode={cameraMode}
          wsUrl={cameraWsUrl}
          telemetry={telemetry}
          telemetryHistory={telemetryHistory}
          events={eventLogRows}
          onCameraConnectionChange={setCamConnected}
        />
      </div>
    </div>
  );
}

const styles = {
  topBarWrap: { flex: "0 0 auto" },

  page: {
    position: "relative",
    width: "100%",
    minHeight: "100dvh",
    overflowX: "hidden",
    overflowY: "visible",
    background: "#060a13",
        // background: "white",
    color: "#e2e8f0",
    padding: 6,
    display: "flex",
    flexDirection: "column",
    gap: 5,
    boxSizing: "border-box",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },

  mainGrid: {
    // Keep map area height stable; bottom section adds scroll.
    flex: "0 0 auto",
    height: "clamp(520px, 62vh, 760px)",
    display: "grid",
    gridTemplateColumns: "230px 1fr 270px",
    gridTemplateRows: "1fr",
    gap: 5,
    alignItems: "stretch",
    overflow: "hidden",
  },

  centerCol: {
    minWidth: 0,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  rightCol: {
    minWidth: 0,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
  },

  mapCard: {
    flex: 1,
    minHeight: 0,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(12, 17, 29, 0.6)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },

  mapHeader: {
    flex: "0 0 auto",
    padding: "8px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },

  mapTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#94a3b8",
    letterSpacing: "0.06em",
  },

  mapSub: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
  },

  mapBody: {
    flex: "1 1 0",
    minHeight: 0,
    position: "relative",
    display: "flex",
    flexDirection: "column",
  },

  droneMapRoot: {
    flex: "1 1 auto",
    minHeight: 0,
    height: "100%",
    width: "100%",
    position: "relative",
  },

  kpiStripWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "0 10px 10px",
    zIndex: 5,
    pointerEvents: "none",
  },

  mergeDebugPanel: {
    position: "absolute",
    bottom: 52,
    left: 8,
    right: 8,
    maxHeight: "30vh",
    overflow: "auto",
    zIndex: 6,
    pointerEvents: "auto",
    background: "rgba(6, 10, 19, 0.94)",
    border: "1px solid rgba(56, 189, 248, 0.4)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
  },

  mergeDebugTitle: {
    fontWeight: 700,
    color: "#38bdf8",
    marginBottom: 4,
    fontSize: 11,
    letterSpacing: "0.02em",
  },

  mergeDebugHint: {
    color: "#94a3b8",
    margin: "0 0 8px",
    lineHeight: 1.4,
    fontSize: 9,
  },

  mergeDebugPre: {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#cbd5e1",
    fontSize: 9,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },

  bottomWrap: {
    flex: "0 0 auto",
    height: "auto",
    // Give BottomSection more room while staying responsive
    minHeight: "clamp(320px, 40vh, 560px)",
    overflowX: "hidden",
    overflowY: "visible",
  },
};
