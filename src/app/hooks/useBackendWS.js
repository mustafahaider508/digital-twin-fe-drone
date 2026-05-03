"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Consider telemetry "live" only if we received drone_state recently.
const LIVE_TIMEOUT_MS = 3000;

const DEBUG_BACKEND_WS =
  process.env.NEXT_PUBLIC_DEBUG_BACKEND_WS === "1" ||
  process.env.NEXT_PUBLIC_DEBUG_BACKEND_WS === "true";

function previewData(data, maxLen = 360) {
  if (data == null) return null;
  try {
    const s = typeof data === "string" ? data : JSON.stringify(data);
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}…`;
  } catch {
    return String(data);
  }
}

function summarizeWsMessage(msg) {
  const type = msg && typeof msg === "object" && msg.type != null ? String(msg.type) : "unknown";
  const data = msg && typeof msg === "object" ? msg.data : undefined;

  let droneId = null;
  let lat = null;
  let lon = null;
  let ts = null;

  if (data && typeof data === "object") {
    const p = data.payload && typeof data.payload === "object" ? data.payload : data;
    droneId = p.droneId ?? p.deviceId ?? null;
    lat = p.lat ?? p.latitude ?? (p.position && p.position.lat) ?? null;
    lon = p.lon ?? p.lng ?? p.longitude ?? (p.position && p.position.lon) ?? null;
    ts = p.ts ?? p.timestamp ?? null;
  }

  return {
    type,
    droneId,
    lat,
    lon,
    ts,
    dataPreview: previewData(data, 420),
  };
}

function extractDroneTs(data) {
  if (!data || typeof data !== "object") return null;
  const raw = data.payload && typeof data.payload === "object" ? data.payload : data;
  const v = raw.ts ?? raw.timestamp;
  if (v == null) return null;
  const ms = new Date(v).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export default function useBackendWS(wsUrl) {
  const wsRef = useRef(null);
  // "connected" here means: we are receiving live drone_state (not just TCP/WS open).
  const [connected, setConnected] = useState(false);
  const lastDroneStateAtRef = useRef(null);

  // ✅ latest live data
  const [droneState, setDroneState] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);

  // Debug: last WS messages seen (only populated when NEXT_PUBLIC_DEBUG_BACKEND_WS=1)
  const [wsIngestTail, setWsIngestTail] = useState([]);

  // T1: sync latency (browser receive vs payload ts) + drone_state rate (sliding 1s window)
  const droneStateArrivalRef = useRef([]);
  const [syncLatencyMs, setSyncLatencyMs] = useState(null);
  const [droneStateHz, setDroneStateHz] = useState(0);

  const pruneArrivalWindow = useCallback(() => {
    const now = Date.now();
    droneStateArrivalRef.current = droneStateArrivalRef.current.filter((t) => now - t <= 1000);
    setDroneStateHz(droneStateArrivalRef.current.length);
  }, []);

  useEffect(() => {
    if (!wsUrl) return;
    const tick = setInterval(() => {
      pruneArrivalWindow();
      const last = lastDroneStateAtRef.current;
      const live = last != null && Date.now() - last <= LIVE_TIMEOUT_MS;
      setConnected(live);
    }, 500);
    return () => clearInterval(tick);
  }, [wsUrl, pruneArrivalWindow]);

  useEffect(() => {
    // If telemetry stops, clear stale merged state so KPIs can't show last-known values as "live".
    if (!connected) {
      setDroneState(null);
      setSyncLatencyMs(null);
    }
  }, [connected]);

  useEffect(() => {
    if (!wsUrl) return;

    let shouldReconnect = true;
    let retry = 0;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        // Don't mark "connected" until we receive drone_state.
        setConnected(false);
        console.log("✅ WS connected:", wsUrl);
      };

      ws.onclose = () => {
        setConnected(false);
        lastDroneStateAtRef.current = null;
        droneStateArrivalRef.current = [];
        setDroneStateHz(0);
        setSyncLatencyMs(null);
        console.log("⚠️ WS closed");
        if (!shouldReconnect) return;

        retry++;
        const delay = Math.min(15000, 500 * Math.pow(2, retry));
        setTimeout(connect, delay);
      };

      ws.onerror = (e) => {
        console.log("❌ WS error", e);
        try { ws.close(); } catch {}
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);

          if (DEBUG_BACKEND_WS) {
            const receivedAt = Date.now();
            const summary = summarizeWsMessage(msg);
            setWsIngestTail((prev) => {
              const next = [
                {
                  receivedAt,
                  receivedIso: new Date(receivedAt).toISOString(),
                  ...summary,
                },
                ...(Array.isArray(prev) ? prev : []),
              ];
              return next.slice(0, 25);
            });
            // Also log a single-line trace for copy/paste debugging.
            console.log(
              `[BackendWS] ${summary.type}`,
              summary.droneId ? `droneId=${summary.droneId}` : "",
              summary.lat != null && summary.lon != null ? `lat=${summary.lat} lon=${summary.lon}` : "",
              summary.ts != null ? `ts=${summary.ts}` : ""
            );
          }

          // Backend format: { type, data }
          if (msg.type === "snapshot") {
            // Snapshot can contain stale droneState; don't let it masquerade as live telemetry.
            // We still load events/stats if present.
            if (Array.isArray(msg.data?.events)) setEvents(msg.data.events);
            if (msg.data?.stats) setStats(msg.data.stats);
          }

          // ✅ live drone update from Express (rebroadcasted from Node-RED)
          if (msg.type === "drone_state") {
            const now = Date.now();
            lastDroneStateAtRef.current = now;
            droneStateArrivalRef.current.push(now);
            pruneArrivalWindow();

            const sent = extractDroneTs(msg.data);
            if (sent != null) {
              setSyncLatencyMs(Math.max(0, now - sent));
            }

            setDroneState(msg.data);
          }

          // optional streams you already have
          if (msg.type === "anomaly" && msg.data && typeof msg.data === "object") {
            setEvents((prev) => {
              const list = Array.isArray(prev) ? prev : [];
              return [msg.data, ...list].slice(0, 50);
            });
          }
        } catch (err) {
          // ignore non-json
        }
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      try { wsRef.current?.close(); } catch {}
    };
  }, [wsUrl, pruneArrivalWindow]);

  return {
    connected,
    droneState,
    events,
    stats,
    syncLatencyMs,
    droneStateHz,
    ...(DEBUG_BACKEND_WS ? { wsIngestTail } : {}),
  };
}
