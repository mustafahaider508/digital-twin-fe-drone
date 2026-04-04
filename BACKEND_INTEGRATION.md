# Backend integration (current design)

## Camera feed — direct WebSocket

- **drone_cam_script.py** connects directly to `ws://smartiotcloud.io:38817/ws` and sends JPEG frames.
- **Frontend** (CameraFeed in BottomSection) connects to the same URL: `ws://smartiotcloud.io:38817/ws`.
- No Node-RED or backend in the middle for the camera stream.

## Dashboard

- **DroneDashboard** uses static telemetry and passes `wsUrl="ws://smartiotcloud.io:38817/ws"` to BottomSection for the camera feed.
- **Backend** (simulator/server.js) serves telemetry/drone state on `/ws` and can connect to Node-RED for drone-state only (no camera paths).
