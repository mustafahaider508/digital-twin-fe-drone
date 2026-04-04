"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const [connected, setConnected] = useState(false);

  // ✅ latest live data
  const [droneState, setDroneState] = useState(null);
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);

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
    const tick = setInterval(pruneArrivalWindow, 500);
    return () => clearInterval(tick);
  }, [wsUrl, pruneArrivalWindow]);

  useEffect(() => {
    if (!wsUrl) return;

    let shouldReconnect = true;
    let retry = 0;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retry = 0;
        setConnected(true);
        console.log("✅ WS connected:", wsUrl);
      };

      ws.onclose = () => {
        setConnected(false);
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

          // Backend format: { type, data }
          if (msg.type === "snapshot") {
            // includes droneState if you added it (recommended)
            if (msg.data?.droneState) setDroneState(msg.data.droneState);
            if (Array.isArray(msg.data?.events)) setEvents(msg.data.events);
            if (msg.data?.stats) setStats(msg.data.stats);
          }

          // ✅ live drone update from Express (rebroadcasted from Node-RED)
          if (msg.type === "drone_state") {
            const now = Date.now();
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

  return { connected, droneState, events, stats, syncLatencyMs, droneStateHz };
}