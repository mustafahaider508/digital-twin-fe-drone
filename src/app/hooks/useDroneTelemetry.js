"use client";

import { useMemo, useEffect, useRef } from "react";
import useBackendWS from "./useBackendWS";

const DEBUG_TELEMETRY =
  process.env.NEXT_PUBLIC_DEBUG_DRONE_TELEMETRY === "1" ||
  process.env.NEXT_PUBLIC_DEBUG_DRONE_TELEMETRY === "true";

/**
 * Pretty console view: same values as merged drone_state, grouped by the MQTT segment
 * topics the simulator merges (browser still receives one WS message).
 */
function buildSegmentedJsonView(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.droneId || "drone_1";
  return {
    _comment:
      "Values mirror dash/<deviceId>/<field> + dash/drone/position on the broker; server merges into one drone_state.",
    segments: {
      "dash/drone/position": {
        lat: raw.lat,
        lon: raw.lon,
        alt: raw.alt,
        droneId: id,
      },
      [`dash/${id}/battery`]: raw.battery,
      [`dash/${id}/speed`]: raw.speed,
      [`dash/${id}/altitude`]: raw.altitude ?? raw.alt,
      [`dash/${id}/yaw`]: raw.yaw,
      [`dash/${id}/pitch`]: raw.pitch,
      [`dash/${id}/roll`]: raw.roll,
      [`dash/${id}/dist_gcs`]: raw.dist_gcs,
      [`dash/${id}/flight_time_left`]: raw.flight_time_left,
    },
    mergedCanonical: {
      schemaVersion: raw.schemaVersion ?? null,
      units: raw.units ?? null,
      ts: raw.ts ?? null,
    },
  };
}

/**
 * Parse backend values: "20 Degrees" -> 20, "280m" -> 280, "55mins" -> 55
 */
function parseNumber(value) {
  if (value == null) return 0;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const s = String(value).replace(/[^0-9.+-]/g, "").trim();
  const n = parseFloat(s);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Default telemetry shape so RightPanel and other consumers never get undefined.
 */
const DEFAULT_TELEMETRY = {
  battery: 0,
  speed: 0,
  altitude: 0,
  distToGcs: 0,
  flightTime: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
  status: "—",
};

/**
 * Map backend drone state to the telemetry shape expected by RightPanel, KpiStrip, etc.
 * Handles both merged WS payload (drone_state) and raw field names from backend.
 */
function mapDroneStateToTelemetry(droneState, connected) {
  if (!droneState) {
    return {
      ...DEFAULT_TELEMETRY,
      status: connected ? "—" : "DISCONNECTED",
    };
  }

  const raw = droneState.payload || droneState;
  const battery = raw.battery != null ? parseNumber(raw.battery) : DEFAULT_TELEMETRY.battery;
  const speed = raw.speed != null ? parseNumber(raw.speed) : DEFAULT_TELEMETRY.speed;
  const altitude = raw.altitude != null ? parseNumber(raw.altitude) : (raw.alt != null ? parseNumber(raw.alt) : DEFAULT_TELEMETRY.altitude);
  const distRaw = raw.dist_gcs ?? raw.distToGcs;
  const distToGcs = distRaw != null ? parseNumber(distRaw) : DEFAULT_TELEMETRY.distToGcs;
  const timeRaw = raw.flight_time_left ?? raw.flightTime ?? raw.flight_time;
  const flightTime = timeRaw != null ? parseNumber(timeRaw) : DEFAULT_TELEMETRY.flightTime;
  const yaw = raw.yaw != null ? parseNumber(raw.yaw) : DEFAULT_TELEMETRY.yaw;
  const pitch = raw.pitch != null ? parseNumber(raw.pitch) : DEFAULT_TELEMETRY.pitch;
  const roll = raw.roll != null ? parseNumber(raw.roll) : DEFAULT_TELEMETRY.roll;

  return {
    battery,
    speed,
    altitude,
    distToGcs,
    flightTime,
    yaw,
    pitch,
    roll,
    status: connected ? "LIVE" : "DISCONNECTED",
  };
}

/**
 * Real-time drone telemetry from backend WebSocket.
 * Use this in the dashboard and pass returned `telemetry` to RightPanel, KpiStrip, TopBar, etc.
 *
 * @param {string} wsUrl - WebSocket URL that receives merged drone_state (e.g. ws://smartiotcloud.io:38817/ws)
 * @returns {{ telemetry, connected, droneState, events, stats, syncLatencyMs, droneStateHz }}
 */
export default function useDroneTelemetry(wsUrl) {
  const { connected, droneState, events, stats, syncLatencyMs, droneStateHz } = useBackendWS(wsUrl);

  const telemetry = useMemo(
    () => mapDroneStateToTelemetry(droneState, connected),
    [droneState, connected]
  );

  const lastDebugLogRef = useRef(0);
  useEffect(() => {
    if (!DEBUG_TELEMETRY) return;

    const now = Date.now();
    if (now - lastDebugLogRef.current < 1000) return;
    lastDebugLogRef.current = now;

    console.log(
      "%c[DroneTelemetry] telemetry (UI / KPI / RightPanel)\n",
      "color:#34d399;font-weight:bold;",
      JSON.stringify(telemetry, null, 2)
    );

    const raw = droneState?.payload && typeof droneState.payload === "object" ? droneState.payload : droneState;
    if (!raw) return;

    const segmented = buildSegmentedJsonView(raw);
    const mergedJson = JSON.stringify(raw, null, 2);
    const segmentedJson = JSON.stringify(segmented, null, 2);

    console.info("[DroneTelemetry] merged backend → UI (object)", {
      schemaVersion: raw.schemaVersion ?? "(missing — old backend?)",
      hasUnits: raw.units != null,
      mappedForPanels: telemetry,
    });

    console.log(
      "%c[DroneTelemetry] segmented JSON (topic-aligned copy)\n",
      "color:#38bdf8;font-weight:bold;",
      segmentedJson
    );
    console.log(
      "%c[DroneTelemetry] full merged drone_state JSON (WebSocket payload)\n",
      "color:#a78bfa;font-weight:bold;",
      mergedJson
    );
  }, [droneState, telemetry, connected]);

  return useMemo(
    () => ({
      telemetry,
      connected,
      droneState,
      events,
      stats,
      syncLatencyMs,
      droneStateHz,
    }),
    [telemetry, connected, droneState, events, stats, syncLatencyMs, droneStateHz]
  );
}
