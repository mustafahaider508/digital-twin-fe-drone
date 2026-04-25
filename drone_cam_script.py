"""
Drone camera relay (Option A).

Runs a local WebSocket server that broadcasts JPEG frames to the dashboard `CameraFeed`.

Frame source options:
  - Video file (default for dissertation demos: `drone.mp4` next to this script)
  - Webcam
  - RTSP (future: real drone camera)
  - Dummy synthetic feed (fallback)

Camera WS (UI connects here):
  ws://127.0.0.1:8765

Telemetry WS (optional, for overlay sync):
  ws://127.0.0.1:5555/ws

Env:
  DRONE_CAM_MODE=server|producer           (default: server)
  DRONE_CAM_SERVER_HOST=127.0.0.1
  DRONE_CAM_SERVER_PORT=8765
  DRONE_CAM_SOURCE=file|webcam|rtsp|dummy (default: file)
  DRONE_CAM_DEVICE_INDEX=0                 (webcam)
  DRONE_CAM_FILE=/path/to/video.mp4        (file)
  DRONE_CAM_RTSP_URL=rtsp://...            (rtsp)
  DRONE_CAM_FPS=15
  DRONE_CAM_WIDTH=640
  DRONE_CAM_HEIGHT=360
  DRONE_CAM_JPEG_QUALITY=70
"""

import asyncio
import errno
import os
import sys
import time
import math

import cv2
import websockets
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DEMO_MP4 = os.path.join(SCRIPT_DIR, "drone.mp4")

_DRONE_ID = os.environ.get("DRONE_ID", "drone-01")
_DEFAULT_PORT = os.environ.get("DRONE_CAM_BACKEND_PORT", "5555")
DEFAULT_WS_URL = (
    f"ws://127.0.0.1:{_DEFAULT_PORT}/stream?role=producer&droneId={_DRONE_ID}"
)
_conn_refused_hint_shown = False


BACKEND_WS_URL = os.environ.get("DRONE_CAM_WS_URL", DEFAULT_WS_URL)

_SERVER_HOST = os.environ.get("DRONE_CAM_SERVER_HOST", "127.0.0.1")
_SERVER_PORT = int(os.environ.get("DRONE_CAM_SERVER_PORT", "8765"))
_MODE = os.environ.get("DRONE_CAM_MODE", "server").strip().lower()  # server | producer
_SOURCE = os.environ.get("DRONE_CAM_SOURCE", "file").strip().lower()  # file|webcam|rtsp|dummy
_FALLBACK = os.environ.get("DRONE_CAM_FALLBACK", "nosignal").strip().lower()  # nosignal|dummy


def _ws_url_for_telemetry(default_port: str) -> str:
    # Allow explicit override
    override = os.environ.get("DRONE_TELEMETRY_WS_URL")
    if override:
        return override
    return f"ws://127.0.0.1:{default_port}/ws"


def _extract_state(msg) -> dict | None:
    """
    Expected backend message shapes (best-effort):
      { "type": "drone_state", "data": { ... } }
      { "type": "snapshot", "data": { "droneState": { ... } } }
    """
    if not isinstance(msg, dict):
        return None

    t = msg.get("type")
    data = msg.get("data")
    if t == "snapshot":
        if isinstance(data, dict):
            data = data.get("droneState") or data.get("drone") or data.get("state") or data
        t = "drone_state"

    if t != "drone_state" or not isinstance(data, dict):
        return None

    # Some servers wrap in payload
    raw = data.get("payload") if isinstance(data.get("payload"), dict) else data

    # Normalize keys used by the UI map overlay
    lat = raw.get("lat")
    lon = raw.get("lon")
    alt = raw.get("alt") or raw.get("altitude")
    yaw = raw.get("yaw")

    # Accept string numbers like "20 Degrees"
    def as_float(v):
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v)
        out = "".join(ch for ch in s if ch.isdigit() or ch in ".+-")
        try:
            return float(out)
        except Exception:
            return None

    latf = as_float(lat)
    lonf = as_float(lon)
    if latf is None or lonf is None:
        return None

    return {
        "droneId": raw.get("droneId") or raw.get("deviceId") or _DRONE_ID,
        "lat": latf,
        "lon": lonf,
        "alt": as_float(alt) or 0.0,
        "yaw": as_float(yaw) or 0.0,
        "ts_ms": int(time.time() * 1000),
    }


def _make_dummy_frame(w: int, h: int, t_ms: int, state: dict) -> "cv2.Mat":
    """
    Generate a synthetic camera-like frame with motion, HUD overlay, and mini-map.
    """
    # More realistic-looking FPV-ish background: sky + textured ground + mild camera shake.
    t = t_ms / 1000.0
    yaw = float(state.get("yaw") or 0.0) % 360.0

    # Camera shake (subtle)
    shake_x = int(math.sin(t * 2.7) * 1.6 + math.sin(t * 7.1) * 0.9)
    shake_y = int(math.cos(t * 2.3) * 1.3 + math.sin(t * 5.2) * 0.8)

    # Horizon position + tiny tilt
    horizon = int(h * 0.42 + math.sin(t * 0.7) * 6)
    tilt_deg = math.sin(t * 0.35) * 1.2

    frame = np.zeros((h, w, 3), dtype=np.uint8)

    # --- Sky (top) ---
    sky_h = max(1, min(h, horizon))
    sky_y = np.linspace(0.0, 1.0, sky_h, dtype=np.float32)[:, None]
    sky = np.zeros((sky_h, w, 3), dtype=np.float32)
    # Gradient sky colors (BGR)
    sky[:, :, 0] = 45 + 25 * (1.0 - sky_y)  # B
    sky[:, :, 1] = 55 + 35 * (1.0 - sky_y)  # G
    sky[:, :, 2] = 70 + 55 * (1.0 - sky_y)  # R

    # Add soft "cloud" noise (fbm-ish via blurred noise)
    cloud = np.random.rand(max(32, sky_h // 2), max(32, w // 3)).astype(np.float32)
    cloud = cv2.GaussianBlur(cloud, (0, 0), 3.2)
    cloud = cv2.resize(cloud, (w, sky_h), interpolation=cv2.INTER_CUBIC)
    cloud = (cloud - cloud.min()) / (cloud.max() - cloud.min() + 1e-6)
    cloud = np.clip((cloud - 0.45) * 1.8, 0.0, 1.0)
    sky += cloud[:, :, None] * np.array([12.0, 14.0, 16.0], dtype=np.float32)

    frame[:sky_h] = np.clip(sky, 0, 255).astype(np.uint8)

    # --- Ground (bottom) ---
    ground_h = h - sky_h
    if ground_h > 0:
        yy = np.linspace(0.0, 1.0, ground_h, dtype=np.float32)[:, None]  # 0 near horizon, 1 near bottom
        xx = np.linspace(-1.0, 1.0, w, dtype=np.float32)[None, :]

        # Perspective warp coordinates for texture sampling
        scale = 0.55 + 3.2 * (yy ** 1.6)
        u = (xx * scale + (t * 0.35)) * 2.2
        v = (yy * 3.8 + (t * 0.65)) * 2.0

        tex = (
            0.55
            + 0.25 * np.sin(2.0 * math.pi * (u * 0.9 + v * 0.35))
            + 0.20 * np.sin(2.0 * math.pi * (u * 1.7 - v * 0.55))
            + 0.10 * np.sin(2.0 * math.pi * (u * 3.1 + v * 1.1))
        ).astype(np.float32)
        tex = (tex - tex.min()) / (tex.max() - tex.min() + 1e-6)

        # Base "terrain" palette (BGR): dusty/greenish
        g = np.zeros((ground_h, w, 3), dtype=np.float32)
        g[:, :, 0] = 58 + tex * 40  # B
        g[:, :, 1] = 78 + tex * 55  # G
        g[:, :, 2] = 64 + tex * 35  # R

        # Add scanline-ish subtle structure like your reference (thin, not bold)
        stripes = (0.5 + 0.5 * np.sin((np.arange(ground_h, dtype=np.float32)[:, None] + t * 35) * 0.22))
        g -= stripes[:, :, None] * np.array([8.0, 8.0, 8.0], dtype=np.float32)

        # Darken toward bottom (exposure)
        g *= (0.92 - 0.18 * yy)[:, :, None]

        frame[sky_h:] = np.clip(g, 0, 255).astype(np.uint8)

    # Apply tilt + shake
    M = cv2.getRotationMatrix2D((w / 2, h / 2), tilt_deg, 1.0)
    M[0, 2] += shake_x
    M[1, 2] += shake_y
    frame = cv2.warpAffine(frame, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

    # Mild vignette
    xv = np.linspace(-1.0, 1.0, w, dtype=np.float32)[None, :]
    yv = np.linspace(-1.0, 1.0, h, dtype=np.float32)[:, None]
    vig = 1.0 - 0.32 * (xv * xv + yv * yv)
    vig = np.clip(vig, 0.65, 1.0)
    frame = np.clip(frame.astype(np.float32) * vig[:, :, None], 0, 255).astype(np.uint8)

    # Lift exposure + contrast a bit so it stays visible in the UI
    brightness = float(os.environ.get("DRONE_CAM_BRIGHTNESS", "16"))  # added value
    contrast = float(os.environ.get("DRONE_CAM_CONTRAST", "1.10"))    # scale
    frame = np.clip(frame.astype(np.float32) * contrast + brightness, 0, 255).astype(np.uint8)

    # Gentle gamma lift (helps dark areas)
    gamma = float(os.environ.get("DRONE_CAM_GAMMA", "0.90"))  # <1 brightens
    inv = 1.0 / max(0.05, gamma)
    lut = (np.linspace(0, 1, 256, dtype=np.float32) ** inv * 255.0).astype(np.uint8)
    frame = cv2.LUT(frame, lut)

    # Slight motion blur / softness (makes it feel less "CG")
    frame = cv2.GaussianBlur(frame, (0, 0), 0.55)

    # Crosshair
    cx, cy = w // 2, h // 2
    cv2.circle(frame, (cx, cy), 18, (0, 0, 0), 4, cv2.LINE_AA)
    cv2.circle(frame, (cx, cy), 18, (125, 255, 200), 1, cv2.LINE_AA)
    cv2.line(frame, (cx - 28, cy), (cx + 28, cy), (125, 255, 200), 1, cv2.LINE_AA)
    cv2.line(frame, (cx, cy - 28), (cx, cy + 28), (125, 255, 200), 1, cv2.LINE_AA)

    # "Drone" heading indicator (top center)
    yaw = float(state.get("yaw") or 0.0) % 360.0
    bar_w = 260
    bar_h = 20
    x0 = cx - bar_w // 2
    y0 = 12
    cv2.rectangle(frame, (x0, y0), (x0 + bar_w, y0 + bar_h), (0, 0, 0), -1)
    cv2.rectangle(frame, (x0, y0), (x0 + bar_w, y0 + bar_h), (60, 70, 90), 1)
    tick = int((yaw / 360.0) * (bar_w - 10))
    cv2.rectangle(frame, (x0 + 5 + tick, y0 + 3), (x0 + 5 + tick + 4, y0 + bar_h - 3), (125, 255, 200), -1)
    cv2.putText(frame, f"HDG {yaw:05.1f}°", (x0 + bar_w + 10, y0 + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 3, cv2.LINE_AA)
    cv2.putText(frame, f"HDG {yaw:05.1f}°", (x0 + bar_w + 10, y0 + 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (230, 236, 245), 1, cv2.LINE_AA)

    # Mini-map (bottom-right)
    mm = 140
    pad = 12
    mx0, my0 = w - mm - pad, h - mm - pad
    cv2.rectangle(frame, (mx0, my0), (mx0 + mm, my0 + mm), (0, 0, 0), -1)
    cv2.rectangle(frame, (mx0, my0), (mx0 + mm, my0 + mm), (60, 70, 90), 1)
    # Fake path loop
    for i in range(0, 360, 18):
        a = (i / 180.0) * math.pi
        px = int(mx0 + mm / 2 + (mm * 0.35) * (math.cos(a)))
        py = int(my0 + mm / 2 + (mm * 0.28) * (math.sin(a)))
        cv2.circle(frame, (px, py), 1, (90, 110, 140), -1)
    a = ((t_ms % 9000) / 9000.0) * 2 * math.pi
    px = int(mx0 + mm / 2 + (mm * 0.35) * (math.cos(a)))
    py = int(my0 + mm / 2 + (mm * 0.28) * (math.sin(a)))
    cv2.circle(frame, (px, py), 4, (70, 220, 160), -1)

    # HUD text
    drone_id = state.get("droneId") or _DRONE_ID
    lat = state.get("lat")
    lon = state.get("lon")
    alt = float(state.get("alt") or 0.0)
    ts = time.strftime("%H:%M:%S", time.localtime(t_ms / 1000.0))

    hud = [
        f"DRONE: {drone_id}",
        f"TIME:  {ts}",
        f"LAT:   {lat:.6f}" if isinstance(lat, (int, float)) else "LAT:   —",
        f"LON:   {lon:.6f}" if isinstance(lon, (int, float)) else "LON:   —",
        f"ALT:   {alt:6.1f} m",
    ]
    x = 12
    y = h - 12 - (len(hud) * 18)

    # HUD background panel for readability
    panel_w = 210
    panel_h = len(hud) * 18 + 14
    px0, py0 = x - 8, y - 16
    overlay = frame.copy()
    cv2.rectangle(overlay, (px0, py0), (px0 + panel_w, py0 + panel_h), (0, 0, 0), -1)
    frame = cv2.addWeighted(overlay, 0.45, frame, 0.55, 0)
    cv2.rectangle(frame, (px0, py0), (px0 + panel_w, py0 + panel_h), (90, 100, 120), 1, cv2.LINE_AA)

    for line in hud:
        cv2.putText(frame, line, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (0, 0, 0), 4, cv2.LINE_AA)
        cv2.putText(frame, line, (x, y), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (238, 242, 248), 1, cv2.LINE_AA)
        y += 18

    return frame


def _make_no_signal_frame(w: int, h: int, t_ms: int, state: dict) -> "cv2.Mat":
    """
    Simple placeholder frame (clean, no synthetic background).
    Used when a real capture source isn't available.
    """
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    # subtle border
    cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (45, 52, 66), 1, cv2.LINE_AA)

    ts = time.strftime("%H:%M:%S", time.localtime(t_ms / 1000.0))
    drone_id = state.get("droneId") or _DRONE_ID
    lines = ["NO SIGNAL", f"DRONE: {drone_id}", f"TIME:  {ts}"]

    x, y = 18, 42
    for i, line in enumerate(lines):
        scale = 1.0 if i == 0 else 0.6
        thickness = 2 if i == 0 else 1
        cv2.putText(frame, line, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), thickness + 3, cv2.LINE_AA)
        cv2.putText(frame, line, (x, y), cv2.FONT_HERSHEY_SIMPLEX, scale, (235, 240, 248), thickness, cv2.LINE_AA)
        y += 34 if i == 0 else 22

    return frame


def _open_capture():
    """
    OpenCV capture based on env config.
    Returns: cv2.VideoCapture or None
    """
    src = _SOURCE
    if src == "dummy":
        return None

    if src == "webcam":
        idx = int(os.environ.get("DRONE_CAM_DEVICE_INDEX", os.environ.get("DRONE_CAMERA_INDEX", "0")))
        cap = cv2.VideoCapture(idx)
        return cap if cap.isOpened() else None

    if src == "file":
        path = os.environ.get("DRONE_CAM_FILE", "").strip() or DEFAULT_DEMO_MP4
        cap = cv2.VideoCapture(path)
        return cap if cap.isOpened() else None

    if src == "rtsp":
        url = os.environ.get("DRONE_CAM_RTSP_URL", "").strip()
        if not url:
            return None
        cap = cv2.VideoCapture(url)
        return cap if cap.isOpened() else None

    return None


def _read_frame(cap):
    """
    Read a frame; for file sources, loop when reaching end.
    Returns: frame (BGR) or None
    """
    if cap is None:
        return None

    ok, frame = cap.read()
    if ok and frame is not None:
        return frame

    if _SOURCE == "file":
        # Many containers report unreliable frame counts on macOS; don't aggressively rewind.
        try:
            fc = float(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0.0)
            fi = float(cap.get(cv2.CAP_PROP_POS_FRAMES) or 0.0)
            at_end = fc > 1.0 and fi >= (fc - 1.0)
        except Exception:
            at_end = False

        if at_end:
            try:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ok2, frame2 = cap.read()
                if ok2 and frame2 is not None:
                    return frame2
            except Exception:
                return None

    return None


def _fit_frame(frame, w: int, h: int):
    """
    Resize/crop to target aspect ratio.
    """
    if frame is None:
        return None
    fh, fw = frame.shape[:2]
    if fh <= 0 or fw <= 0:
        return None

    target_ar = w / float(h)
    src_ar = fw / float(fh)

    if abs(src_ar - target_ar) < 1e-3:
        return cv2.resize(frame, (w, h), interpolation=cv2.INTER_AREA)

    if src_ar > target_ar:
        new_w = int(fh * target_ar)
        x0 = max(0, (fw - new_w) // 2)
        crop = frame[:, x0 : x0 + new_w]
    else:
        new_h = int(fw / target_ar)
        y0 = max(0, (fh - new_h) // 2)
        crop = frame[y0 : y0 + new_h, :]

    return cv2.resize(crop, (w, h), interpolation=cv2.INTER_AREA)


async def _telemetry_listener(shared: dict, lock: asyncio.Lock, ws_url: str):
    """
    Best-effort telemetry consumer; keeps latest (lat/lon/alt/yaw) for overlay sync.
    """
    while True:
        try:
            async with websockets.connect(ws_url, max_size=None, ping_interval=20, ping_timeout=20) as ws:
                print(f"[cam-relay] Telemetry WS connected: {ws_url}", flush=True)
                async for raw in ws:
                    try:
                        import json  # local import to keep startup minimal

                        msg = json.loads(raw)
                        state = _extract_state(msg)
                        if not state:
                            continue
                        if state.get("droneId") not in (_DRONE_ID, None):
                            # Ignore other drones if backend streams multiple.
                            continue
                        async with lock:
                            shared.update(state)
                    except Exception:
                        continue
        except Exception:
            await asyncio.sleep(2.0)


async def send_video():
    if _MODE == "server":
        await run_server()
        return

    while True:
        try:
            async with websockets.connect(
                BACKEND_WS_URL,
                max_size=None,
                ping_interval=20,
                ping_timeout=20,
            ) as websocket:
                print(f"Connected to backend: {BACKEND_WS_URL}")
                fps = float(os.environ.get("DRONE_CAM_FPS", "15"))
                w = int(os.environ.get("DRONE_CAM_WIDTH", "640"))
                h = int(os.environ.get("DRONE_CAM_HEIGHT", "360"))
                jpeg_q = int(os.environ.get("DRONE_CAM_JPEG_QUALITY", "70"))
                delay_s = max(0.001, 1.0 / max(1.0, fps))

                shared = {
                    "droneId": _DRONE_ID,
                    "lat": None,
                    "lon": None,
                    "alt": 30.0,
                    "yaw": 0.0,
                }
                lock = asyncio.Lock()

                # Optional overlay sync from telemetry WS
                telemetry_ws = _ws_url_for_telemetry(_DEFAULT_PORT)
                enable_sync = os.environ.get("DRONE_CAM_SYNC_TELEMETRY", "1").lower() not in (
                    "0",
                    "false",
                    "no",
                )
                tele_task = None
                if enable_sync:
                    tele_task = asyncio.create_task(_telemetry_listener(shared, lock, telemetry_ws))

                t0 = int(time.time() * 1000)

                while True:
                    now = int(time.time() * 1000)

                    # If we don't have telemetry yet, simulate motion so it still looks alive.
                    async with lock:
                        st = dict(shared)
                    if st.get("lat") is None or st.get("lon") is None:
                        t = now - t0
                        a = ((t % 9000) / 9000.0) * 2 * math.pi
                        st["lat"] = 24.583282 + (0.00045 * math.sin(a))
                        st["lon"] = 46.70191 + (0.00055 * math.cos(a))
                        st["yaw"] = (a * 180.0 / math.pi + 90.0) % 360.0
                        st["alt"] = 35.0 + 6.0 * math.sin(a * 2)

                    frame = _make_dummy_frame(w, h, now, st)

                    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_q]
                    ok, buffer = cv2.imencode(".jpg", frame, encode_param)
                    if ok:
                        await websocket.send(buffer.tobytes())

                    await asyncio.sleep(delay_s)

                if tele_task:
                    tele_task.cancel()

        except Exception as e:
            global _conn_refused_hint_shown
            errn = getattr(e, "errno", None)
            is_refused = errn == errno.ECONNREFUSED or isinstance(
                e, ConnectionRefusedError
            )
            if is_refused and not _conn_refused_hint_shown:
                _conn_refused_hint_shown = True
                print(
                    "Connection refused — start the service that accepts this WebSocket, "
                    f"or set DRONE_CAM_WS_URL. Default target: {DEFAULT_WS_URL!r}",
                    file=sys.stderr,
                )
            print("WebSocket connection error:", e)
            print("Retrying in 3 seconds...")
            await asyncio.sleep(3)

async def _viewer_handler(websocket):
    """
    WebSocket server handler for dashboard viewers.
    We push binary JPEG frames to every connected client.
    """
    try:
        await websocket.wait_closed()
    except Exception:
        pass


async def run_server():
    fps = float(os.environ.get("DRONE_CAM_FPS", "15"))
    w = int(os.environ.get("DRONE_CAM_WIDTH", "640"))
    h = int(os.environ.get("DRONE_CAM_HEIGHT", "360"))
    jpeg_q = int(os.environ.get("DRONE_CAM_JPEG_QUALITY", "70"))
    delay_s = max(0.001, 1.0 / max(1.0, fps))

    shared = {
        "droneId": _DRONE_ID,
        "lat": None,
        "lon": None,
        "alt": 30.0,
        "yaw": 0.0,
    }
    lock = asyncio.Lock()

    telemetry_ws = _ws_url_for_telemetry(_DEFAULT_PORT)
    enable_sync = os.environ.get("DRONE_CAM_SYNC_TELEMETRY", "1").lower() not in (
        "0",
        "false",
        "no",
    )
    tele_task = None
    if enable_sync:
        tele_task = asyncio.create_task(_telemetry_listener(shared, lock, telemetry_ws))

    file_path = None
    if _SOURCE == "file":
        file_path = os.environ.get("DRONE_CAM_FILE", "").strip() or DEFAULT_DEMO_MP4

    cap = _open_capture()
    if _SOURCE != "dummy":
        if cap is None:
            print(
                f"[cam-relay] Could not open camera source {_SOURCE!r}. "
                + (f"Tried file: {file_path!r} " if file_path else "")
                + f"Fallback: {_FALLBACK}",
                flush=True,
            )
        else:
            try:
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, w)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, h)
            except Exception:
                pass

    clients = set()

    async def handler(ws):
        clients.add(ws)
        try:
            await ws.wait_closed()
        finally:
            clients.discard(ws)

    async with websockets.serve(handler, _SERVER_HOST, _SERVER_PORT, max_size=None):
        print(f"[cam-relay] Camera WS server listening on ws://{_SERVER_HOST}:{_SERVER_PORT}", flush=True)
        if enable_sync:
            print(f"[cam-relay] Telemetry sync enabled via: {telemetry_ws}", flush=True)
        else:
            print("[cam-relay] Telemetry sync disabled (simulated motion).", flush=True)
        print(f"[cam-relay] Source: {_SOURCE}", flush=True)
        if _SOURCE == "file":
            print(f"[cam-relay] Video file: {file_path!r} (exists={os.path.exists(file_path)})", flush=True)

        t0 = int(time.time() * 1000)
        last_open_try_ms = 0
        last_tick = time.monotonic()
        read_fail_streak = 0

        # Pace file/rtsp playback to the video's native FPS when possible (prevents "stuck" feeling).
        stream_dt = delay_s

        def recompute_stream_dt(capture):
            nonlocal stream_dt
            stream_dt = delay_s
            if capture is None:
                return
            if _SOURCE not in ("file", "rtsp"):
                return
            try:
                vfps = float(capture.get(cv2.CAP_PROP_FPS) or 0.0)
                if vfps > 1.0:
                    stream_dt = max(delay_s, 1.0 / vfps)
            except Exception:
                pass

        recompute_stream_dt(cap)

        while True:
            now = int(time.time() * 1000)

            async with lock:
                st = dict(shared)

            src_frame = None
            if cap is not None:
                src_frame = _read_frame(cap)
                if src_frame is None:
                    read_fail_streak += 1
                else:
                    read_fail_streak = 0

                # Don't drop the capture on a single transient read failure (common with some MP4s).
                if src_frame is None and _SOURCE != "dummy":
                    should_drop = False
                    if _SOURCE in ("webcam", "rtsp"):
                        should_drop = read_fail_streak >= 8
                    elif _SOURCE == "file":
                        # Try a soft rewind a few times before giving up.
                        if read_fail_streak in (3, 6, 10):
                            try:
                                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                            except Exception:
                                pass
                        should_drop = read_fail_streak >= 15

                    if should_drop:
                        try:
                            cap.release()
                        except Exception:
                            pass
                        cap = None
                        read_fail_streak = 0

            if src_frame is not None:
                frame = _fit_frame(src_frame, w, h)
                if frame is None:
                    frame = _make_no_signal_frame(w, h, now, st)
            else:
                if st.get("lat") is None or st.get("lon") is None:
                    t = now - t0
                    a = ((t % 9000) / 9000.0) * 2 * math.pi
                    st["lat"] = 24.583282 + (0.00045 * math.sin(a))
                    st["lon"] = 46.70191 + (0.00055 * math.cos(a))
                    st["yaw"] = (a * 180.0 / math.pi + 90.0) % 360.0
                    st["alt"] = 35.0 + 6.0 * math.sin(a * 2)
                if _SOURCE == "dummy" or _FALLBACK == "dummy":
                    frame = _make_dummy_frame(w, h, now, st)
                else:
                    frame = _make_no_signal_frame(w, h, now, st)
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_q]
            ok, buffer = cv2.imencode(".jpg", frame, encode_param)
            if not ok:
                await asyncio.sleep(delay_s)
                continue

            payload = buffer.tobytes()
            if clients:
                dead = []
                for c in clients:
                    try:
                        await c.send(payload)
                    except Exception:
                        dead.append(c)
                for c in dead:
                    clients.discard(c)

            if cap is None and _SOURCE in ("webcam", "file", "rtsp"):
                if now - last_open_try_ms > 1500:
                    last_open_try_ms = now
                    cap = _open_capture()
                    if cap is not None:
                        recompute_stream_dt(cap)

            # Keep a steady cadence for file/rtsp; for dummy/no-signal use configured FPS.
            tick_dt = stream_dt if (_SOURCE in ("file", "rtsp") and cap is not None) else delay_s
            elapsed = time.monotonic() - last_tick
            if elapsed < tick_dt:
                await asyncio.sleep(max(0.0, tick_dt - elapsed))
            last_tick = time.monotonic()

    if tele_task:
        tele_task.cancel()

    if cap is not None:
        try:
            cap.release()
        except Exception:
            pass

if __name__ == "__main__":
    asyncio.run(send_video())