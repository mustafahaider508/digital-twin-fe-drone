"use client";

import React from "react";
import CameraFeed from "./CameraFeed";
import Telemetry3DChart from "./Telemetry3DChart";
import EventLog from "./EventLog";
import FaultInjectToolbar from "./FaultInjectToolbar";

export default function BottomSection({
  cameraMode,
  wsUrl,
  telemetryHistory,
  events,
  onCameraConnectionChange,
}) {
  const gridCols = cameraMode === "FPV" ? "1fr 1fr" : "1fr 1fr 1fr";

  return (
    <div>
      <div style={{ ...styles.grid, gridTemplateColumns: gridCols }}>
        {cameraMode !== "FPV" ? (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span style={styles.cardTitle}>Camera Feed</span>
            </div>
            <div style={styles.cardBody}>
              <CameraFeed
                enabled={true}
                wsUrl={wsUrl}
                onConnectionChange={onCameraConnectionChange}
              />
              {/* <CameraFeed enabled={true}   wsUrl="ws://localhost:5555/stream?role=viewer&droneId=drone-01" /> */}
            </div>
          </div>
        ) : null}

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span style={styles.cardTitle}>3D Telemetry</span>
          </div>
          <div style={styles.cardBody}>
            <Telemetry3DChart telemetryHistory={telemetryHistory} />
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span style={styles.cardTitle}>Event Log</span>
          </div>
          <FaultInjectToolbar />
          <div style={{ padding: "0 8px 8px", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <EventLog events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(12, 17, 29, 0.85)",
    backdropFilter: "blur(20px)",
    padding: 8,
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 6,
    minHeight: 280,
    flex: 1,
  },
  card: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    minWidth: 0,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#94a3b8",
    letterSpacing: "0.04em",
  },
  cardBody: {
    flex: 1,
    minHeight: 0,
    padding: 6,
  },
};