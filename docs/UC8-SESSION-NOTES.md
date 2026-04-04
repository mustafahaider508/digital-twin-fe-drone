# UC8 Test Execution Plan — full reference (PDF + platform + chat)

This document merges the **UC8 Test Execution Plan** (PDF) content with **this project’s stack** and **implementation notes** from the Cursor session.

---

## 1. What you have (relevant to UC8)

- **Frontend dashboard:** `dt-dashboard-ui` — MapLibre 3D drone + KPI panels; consumes WebSocket telemetry from the backend.
- **Backend:** `Digital-twin-Dashboard/simulator/server.js` — WebSocket `/ws` broadcasts `drone_state` (from MQTT dash topics) and, when ingesting UC2/UC8 readings, broadcasts `telemetry` + `anomaly`. REST: `/ingest`, `/events`, `/twins`, `/stats`.
- **Broader UC8 doc:** Global KPIs (latency, throughput, refresh/render latency, prediction accuracy, security, scalability, etc.) are defined in **UC8 Evaluation and Performance Matrix.pdf** (separate document).

---

## 2. Scope caveat (from plan)

Several UC8 items (**T4, T5, T7, T8, T9, T11**) need capabilities **not** present in `simulator/server.js` or the current UI unless you run a different backend. For those, the plan says to record **Not supported by current code** unless you extend the platform.

---

## 3. Setup (do once)

1. Start the backend simulator aligned with the UI.
   - File: `simulator/server.js`
   - **WebSocket:** `/ws`
   - **REST:** `/ingest`, `/events`, `/twins`, `/stats`, **`/stats/throughput`** (T10 counters + memory + CPU snapshot)
2. Point the Next.js app at the same API base.
   - Example: `NEXT_PUBLIC_API_BASE=http://localhost:5555` in `.env.local`
3. Run the UI in **dashboard mode** to land on the drone dashboard.
   - Component: `src/app/components/DroneDashboard.jsx`
   - Route: **`/dashboard`**
   - WS URL is built from `NEXT_PUBLIC_API_BASE` + `/ws`

---

## 4. How to measure KPIs (plan vs this UI)

The plan originally said the UI might not show every KPI field; you can still measure manually. **This repo now adds UI helpers** where noted below.

### Synchronisation latency / update frequency (T1, T3)

- **Source:** WebSocket `drone_state` messages.
- **Latency:** Compare `Date.now()` (or reception time) to payload time — e.g. `msg.data.ts` (backend may set `ts` at normalization if missing).
- **Update frequency:** Count messages per second with `type === "drone_state"`.
- **In this codebase:**
  - **KPI strip** on `/dashboard`: **SYNC** (ms), **RATE** (/s) — `useBackendWS.js` → `useDroneTelemetry.js` → `KpiStrip.jsx`.

### Visualization refresh / render latency (T3)

- Map + 3D layer repaint each animation frame; position/orientation targets update when WS data arrives.
- **Approximation:** WS `drone_state` rate; **render latency:** correlate payload `ts` with when the map/smoothed model reflects the update.
- **In this codebase:**
  - **`DroneMap.jsx`** — panel **“T3 · VISUALIZATION”**: WS status, last packet age, updates/s (map socket), **Render** (ms from payload `ts` to first smoothed movement toward target).
  - Console: `[UC8-T3 render]` with latencies; `window.exportT3Report()` / `window.getT3Summary()` for CSV/JSON samples.

### Reliability monitoring / fault detection (T6)

- **Backend:** Anomaly rules on ingested UC8-style readings (`simulator/server.js`).
- **Triggers:** `reading.status === "warn"` or `"error"`, or `reading.congestion === true`.
- **Verification:** `GET /events` and/or WebSocket `type: "anomaly"`.
- **In this codebase:**
  - `DroneDashboard.jsx` merges REST `/events` + WS anomalies → `EventLog`.
  - **`FaultInjectToolbar.jsx`** (in `BottomSection`): Warn / Error / Congestion + optional auto-inject (dev or `NEXT_PUBLIC_SIMULATOR_CONTROLS=true`).

### Scalability (T10)

- Increase load via `POST /ingest` rate; measure WS `telemetry` throughput; monitor CPU/memory.
- **In this codebase (simulator):**
  - **`GET /stats/throughput`** — Per completed second (last 120s in `lastSeconds`): `ingestAccepted`, `ingestRejected`, `wsSends`, **`wsSendsByType`** (`telemetry`, `anomaly`, `drone_state`, `snapshot`), **`wsSendFailures`**; **`memory`** (`process.memoryUsage()`); **`cpuPercentApprox`** (rough Node process % over that second). Also `lifetime` totals, `currentSecondPartial`, `wsClientCount`.
  - **Load script:** from repo **`Digital-twin-Dashboard/simulator`**: `npm run load:t10` (runs `test-scripts/load_test.js`). Default phases: **10 / 50 / 100** UC8 ingests per second (configurable via env).
  - **Env (script):** `API_BASE`, `DURATION_PER_PHASE` (default `10`), `T10_RATES` (e.g. `10,50,100`).
  - **Whole-machine CPU/RAM:** still use Activity Monitor, `top`, or `ps` while the script runs (complements Node `heapUsed` / `cpuPercentApprox`).

### Heterogeneous orchestration (T12)

- Send `/ingest` with varied `deviceId` and `type`; verify with `GET /twins`.

---

## 5. UC8 test procedures (T1–T12)

For each test case, record: **Preconditions, Steps, KPIs, Evidence** (screenshots/log snippets), **Pass / Fail / Not supported**.

| ID | Title | Plan status | This platform |
|----|--------|-------------|----------------|
| **T1** | Validate Digital Twin synchronisation with physical CPS assets | Supported (UI + WS) | **Yes.** WS `drone_state`; UI: SYNC + RATE on `/dashboard`. Preconditions: simulator + drone telemetry producer (e.g. MQTT / `drone_telemetry_loc.py`). |
| **T2** | Verify multi-tenant Digital Twin isolation | Not supported (single tenant) | **Yes (Phase A+B).** `tenantId` on ingest; `X-Tenant-Id` on reads; `/ws?tenantId=`; MQTT topic segment `sdn|dt/<tenant>/...`; UI tenant selector (`TenantProvider`). Optional `INGEST_API_KEY`. |
| **T3** | Validate Digital Twin visualisation services | Supported | **Yes.** MapLibre + 3D + KPIs; UI: T3 panel + logs/export on map. |
| **T4** | Evaluate semantic-aware CPS messaging | Not in simulator | **Not supported** by current backend. |
| **T5** | Validate predictive analytics capability | Not implemented | **Not supported** unless you add a prediction service. |
| **T6** | Evaluate CPS reliability monitoring | Partial → **now full in UI** | **Yes.** `/ingest` fault injection, `/events`, WS `anomaly`, event log + fault toolbar. |
| **T7** | Validate adaptive resource orchestration | Not implemented | **Not supported.** |
| **T8** | Evaluate edge-to-cloud CPS coordination | Not implemented | **Not supported.** |
| **T9** | Validate AI-driven CPS control loops | Not implemented | **Not supported.** |
| **T10** | Assess scalability with increasing CPS assets | Supported (smoke) | **Yes** — `npm run load:t10` + **`GET /stats/throughput`** for ingest/WS rates, failures, memory, process CPU%. |
| **T11** | Validate secure and trustworthy CPS coordination | Not implemented | **Not supported** (no auth/zoning in simulator as described). |
| **T12** | Validate digital twin orchestration across heterogeneous CPS | Supported | **Yes.** `/ingest` + `/twins`; UI list/detail under `src/app/page.js`, `src/app/twins/[id]/page.js`. |

### T1 (detail)

- **Preconditions:** Simulator running; drone telemetry producer (MQTT `dash/drone/*` or equivalent).
- **Steps:** Open dashboard; confirm WS connectivity (map panel shows WS status).
- **KPIs:** Sync latency (`ts` vs receive time); `drone_state` messages/sec.
- **Expected:** Map position/orientation and KPIs update near real-time.

### T3 (detail)

- **Preconditions:** Same as T1.
- **Steps:** Observe 3D drone movement/rotation and KPI gauges.
- **KPIs:** Visualization refresh rate; rendering latency (payload `ts` vs visual update — use T3 panel + console/export).

### T6 (detail)

- **Preconditions:** Simulator running.
- **Fault injection:** `POST /ingest` with `layer: "UC8"`, `status: "warn"` or `"error"`, or `congestion: true`, plus `deviceId` and `timestamp`.
- **KPIs:** Fault detection time (`/ingest` → event visible); system response when returning to `status: "ok"`.
- **Expected:** `/events` contains anomaly; WS emits `anomaly`.

### T10 (detail)

- **Steps:** Start simulator. Optionally open the dashboard so at least one browser holds a `/ws` connection (increases `wsSends` per ingest). From **`simulator/`** run **`npm run load:t10`** (or `node test-scripts/load_test.js`). Optionally tune `DURATION_PER_PHASE` / `T10_RATES`. Poll **`http://localhost:5555/stats/throughput`** during or after each phase (the script prints a snapshot after each phase).
- **KPIs:** Ingest accepted/rejected per second; WebSocket sends per second (and by type, especially `telemetry`); client-side average `POST /ingest` latency from the script; `heapUsed` / `cpuPercentApprox` from `lastSeconds[0]`; OS-level CPU/memory from your monitor of choice.
- **Expected:** Predictable scaling; no crash; acceptable degradation.

### T12 (detail)

- **Steps:** Multiple `/ingest` payloads with different `deviceId`, `type` (e.g. robot/drone/sensor), `layer: "UC8"`.
- **Verification:** `GET /twins` — count and `type` / `sensorType` match.

---

## 6. Deliverable (from plan)

- One **UC8 report** with rows **T1–T12**.
- Each row: **Pass / Fail / Not supported**, KPIs, evidence.
- Optional later: Playwright automation (plan was instructions-only if automation = A).

---

## 7. Key files (implementation map)

| Area | Files |
|------|--------|
| Dashboard page | `src/app/dashboard/page.jsx` → `DroneDashboard.jsx` |
| Map only | `src/app/droneMap/page.jsx` → `DroneMap.jsx` |
| WS + T1 metrics | `src/app/hooks/useBackendWS.js`, `useDroneTelemetry.js` |
| KPI strip | `src/app/components/KpiStrip.jsx` |
| Map + T3 | `src/app/components/DroneMap.jsx` |
| Events / T6 | `DroneDashboard.jsx`, `EventLog.jsx`, `BottomSection.jsx`, `FaultInjectToolbar.jsx` |
| Twins / T12 | `src/app/page.js`, `src/app/twins/[id]/page.js` |
| Backend | `../simulator/server.js` (sibling repo) |
| T10 load + metrics | `simulator/test-scripts/load_test.js`, `npm run load:t10`, **`GET /stats/throughput`** |

---

## 8. Environment variables

- `NEXT_PUBLIC_API_BASE` — HTTP API + derived WS URL (e.g. `http://localhost:5555`).
- `NEXT_PUBLIC_SIMULATOR_CONTROLS=true` — Show UC8 fault injection toolbar in non-dev builds.
- `NEXT_PUBLIC_CESIUM_ION_TOKEN` / `NEXT_PUBLIC_MAPTILER_KEY` — Map-related (if used).

### T2 multi-tenant (simulator)

- `DEFAULT_TENANT` — fallback tenant id (default `default`).
- `INGEST_API_KEY` — if set, `POST /ingest` requires `X-API-Key` or `Authorization: Bearer <key>`.

### T2 multi-tenant (Next.js)

- `NEXT_PUBLIC_DEFAULT_TENANT` — initial tenant (default `default`).
- `NEXT_PUBLIC_TENANT_PRESETS` — comma-separated list for dropdowns (default `default,acme,demo`).

---

## 9. Chat vs PDF

- The **PDF** is the authoritative test *procedure*; this file captures its text structure and maps it to **your repo**.
- **Cursor chat** is not exported automatically; this markdown is the durable snapshot for the workspace. For the exact original PDF wording, keep **UC8 Test Execution Plan.pdf** alongside this doc.

---

## 10. Cursor chat snapshot — 2026-03-28 (saved to report)

*This section records outcomes from a Cursor session on **dt-dashboard-ui** + T2; use it as report evidence or appendix.*

### Problem / goal

- Avoid duplicating **unit** vs **tenant** controls across top/side panels; align with dashboard glass theme; keep **T2** multi-tenant behavior intact.

### UI decisions implemented

1. **Tenant vs units on sidebars**  
   - **Left (Fleet):** **TENANT** only (no UNITS list). Tenant is chosen via a **`<select>`** (not a button list).  
   - **Right (Workspace):** **TENANT control removed** so tenant is configured only on the left; right panel stays telemetry (stream status, battery, KPIs, orientation).

2. **Tenant control styling**  
   - Shared component: `src/app/components/TenantSelectControl.jsx` — glass/gradient shell consistent with sidebar KPI cards, custom chevron, focus ring.  
   - **Green dot + `ACTIVE` label** (`#34d399`, glow aligned with TopBar live / LINK STATUS ONLINE).  
   - Global helpers: `src/app/globals.css` — `.dt-tenant-shell` (focus-within), `.dt-tenant-select` / `option` dark theme.

3. **Dashboard wiring**  
   - `DroneDashboard.jsx`: WS URL `?tenantId=`, `/events` with `tenantHeaders(tenantId)`; `/twins` prefetch for unit list **removed** when UNITS sidebar was dropped (tenant scope only from sidebar).  
   - `LeftSidebar.jsx`: `TenantSelectControl` + `PRESETS` / `setTenantId` from `TenantProvider`.

### T2 multi-tenant — closure statement (from chat)

- For **UC8 Phase A+B** in this repo, **T2 is treated as complete**: simulator keys twins by tenant, ingest/read/WS respect tenant, UI sends `X-Tenant-Id` and subscribes to `/ws?tenantId=`, optional `INGEST_API_KEY`.  
- **Out of scope** for this T2 slice: full **T11**-style security (auth/RBAC, audit). Formal isolation evidence still requires your own two-tenant test runs and screenshots/logs.

### Files referenced in this session

| Area | Path |
|------|------|
| Tenant UI | `src/app/components/TenantSelectControl.jsx`, `LeftSidebar.jsx`, `RightPanel.jsx` |
| Theme / select | `src/app/globals.css` |
| Shell | `src/app/components/DroneDashboard.jsx`, `src/app/providers/TenantProvider.jsx` |
| Backend T2 | `Digital-twin-Dashboard/simulator/server.js` (outside this package root) |

---

*Last consolidated from the UC8 Test Execution Plan PDF and the Digital Twin dashboard session. Section 10 appended from Cursor chat — 2026-03-28.*
