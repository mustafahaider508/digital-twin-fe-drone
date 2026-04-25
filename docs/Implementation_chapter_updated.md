# Chapter 5 — Implementation (Updated to Match This Project)

## 5.1 Introduction

This chapter documents the practical implementation of the drone digital twin dashboard built in this project. The implementation goal was to create a working runtime monitoring dashboard that can accept live telemetry, maintain an up-to-date drone state, and present that state in a user-friendly operational view.

The delivered system uses:

- Python scripts for telemetry publishing (segmented MQTT topics + position stream)
- Node-RED for telemetry processing and state merging (function nodes + flow context)
- WebSocket delivery of a single merged `drone_state` object to the frontend
- A Next.js dashboard UI that renders a live map + 3D drone model (MapLibre + Three.js/GLB)
- A separate WebSocket camera stream (kept distinct from structured telemetry)

Important scope note: this implementation is a **prototype** aimed at real-time monitoring and UC8-aligned evaluation signals (synchronisation, refresh rate, render latency, fault visibility). Advanced UC8 themes (full orchestration, access control, AI control loops, and full semantic messaging) are treated as future work unless explicitly implemented.

## 5.2 Implementation Architecture (as implemented)

Figure 5.1 (conceptual) is implemented using the following components and interfaces.

### 5.2.1 Telemetry publishers (Python)

The telemetry publisher in this repository is `drone_telemetry_loc.py`. It publishes:

- **Metric segments** to MQTT: `dash/<droneId>/<metric>` on `smartiotcloud.io:38131`
- **Position updates** to MQTT: `dash/drone/position` on `smartiotcloud.io:40387` (for Node-RED ingestion/merge)

In addition, the script also maintains a “delete previous marker then publish new marker” behaviour for map-style dashboards where a single marker name is used and old markers should be cleared.

### 5.2.2 Node-RED runtime core (cloud-hosted or local)

Node-RED acts as the runtime “digital twin core” by:

- subscribing to segmented telemetry topics,
- parsing and normalising values (e.g., `"20 Degrees"` → `20`),
- maintaining the latest state per drone in flow context,
- emitting a single merged state object for downstream consumers.

In the implementation, Node-RED is responsible for state assembly so the frontend does not need to subscribe to many topics.

### 5.2.3 Backend WebSocket (project-level integration)

The frontend connects to a WebSocket endpoint at:

- `ws://<backend-host>:5555/ws` (development default)

In this project, the WebSocket backend that merges MQTT segments and rebroadcasts `drone_state` is **not located inside** `dt-dashboard-ui`. It is implemented in the sibling backend module:

- `Digital-twin-Dashboard/simulator/server.js`

This design keeps the dashboard UI independent, while the backend provides a consistent message schema to the UI.

### 5.2.4 Frontend dashboard UI (this repository)

The dashboard is implemented in this repository (`dt-dashboard-ui`) and includes:

- A 3D map + drone model view (`src/app/components/DroneMap.jsx`)
- Operational KPI and status panels (`src/app/components/DroneDashboard.jsx` and related components)
- UC8-oriented instrumentation for:
  - **T1** synchronisation latency / update frequency (via `useBackendWS.js`)
  - **T3** visualisation refresh and render-latency approximations (via the T3 panel embedded in `DroneMap.jsx`)

### 5.2.5 Dashboard hosted inside Node-RED (uibuilder)

The project supports hosting the built dashboard inside Node-RED using **uibuilder** so the UI is accessible at:

- `http://localhost:1880/drone-map`

The build and deployment steps are implemented in:

- `build-uibuilder.sh`
- `docs/NODE-RED-DASHBOARD-INTEGRATION.md`

This allows the dashboard to run “within” Node-RED from the user perspective, while still being authored as a Next.js application.

## 5.3 Telemetry State Processing Flow (Node-RED)

The Node-RED flow follows the same logic used by the prototype design:

1. **Subscribe** to `dash/drone/position` (position JSON)
2. **Subscribe** to segmented metric topics under `dash/<droneId>/...`
3. **Normalise** values (string + units to numeric where applicable)
4. **Merge** the latest position + metrics into a single runtime state stored in flow context
5. **Broadcast** the merged `drone_state` to the dashboard

The outcome is a compact state object that contains:

- `droneId`, `lat`, `lon`, `alt`
- `yaw`, `pitch`, `roll`
- `battery`, `speed`, `dist_gcs`, `flight_time_left`
- `ts` (timestamp)

## 5.4 Simulated Route and State Publishing (as in this codebase)

The telemetry publisher can simulate movement by iterating over a list of geographic coordinates and publishing a position update each loop.

Implementation note for this repository:

- If the coordinates list contains repeated values (same lat/lon), the drone will **not visibly move**. This is acceptable for connectivity and schema validation tests, but for “route simulation” evidence the coordinates should vary over time.

## 5.5 Runtime Integration and Dashboard Behaviour

The integration is event-driven:

- When position/metrics arrive, Node-RED (and/or the backend merge layer) updates the last known state.
- The frontend subscribes to a single WebSocket stream (`/ws`) and updates the dashboard from the merged `drone_state`.

The UI’s map and 3D drone model is rendered with MapLibre + a Three.js custom layer. The UI performs smoothing so that motion and attitude changes appear continuous even when telemetry arrives discretely.

## 5.6 Camera Stream (kept separate from telemetry)

The camera stream is intentionally separated from structured telemetry:

- **Telemetry** remains numeric/state data and is processed/merged.
- **Camera** remains binary JPEG frames sent over WebSocket.

This repository contains `drone_cam_script.py` for streaming frames. In deployment, the design supports a direct camera WebSocket endpoint (e.g., `ws://smartiotcloud.io:38817/ws`). In local development, an alternative mode may stream through the backend (e.g., `/stream?role=producer`) depending on the backend configuration.

## 5.7 UC8-Oriented Implementation Coverage (what is actually supported)

This project directly supports UC8-style evaluation for:

- **Synchronisation and runtime awareness** (merged `drone_state` + timestamps)
- **Visualisation refresh and rendering responsiveness** (dashboard + map + 3D drone)
- **Reliability monitoring readiness** (events/anomalies visible in the UI when produced by the backend)
- **Scalability smoke testing** (supported by the backend’s throughput stats and load scripts in the sibling module)

Items not implemented in the current prototype (and therefore treated as future work) include:

- full semantic-aware CPS messaging,
- predictive analytics/control loops,
- adaptive orchestration,
- complete security/RBAC enforcement.

## 5.8 Reproducibility Summary (recommended for the final report)

To make this chapter verifiable, the final dissertation/report version should include:

- exact MQTT brokers/ports/topics used,
- the Node-RED flow export (JSON) or a detailed flow screenshot with node configs,
- backend WebSocket URL and schema,
- steps to build/deploy the dashboard into Node-RED uibuilder,
- evidence screenshots/log snippets (WS connected, state updates, Node-RED debug view).

