// "use client";

// import { useEffect, useRef, useCallback, useMemo, useState } from "react";
// import maplibregl from "maplibre-gl";
// import * as THREE from "three";
// import { GLTFLoader } from "three-stdlib";

// const BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH || "";

// // Camera defaults
// const DEFAULT_ZOOM = 18;
// const DEFAULT_PITCH = 72;
// const DEFAULT_BEARING = -22;
// const MAX_ZOOM = 22;

// const FOCUS_ZOOM = 19;
// const FOCUS_PITCH = 75;

// // Satellite style (Esri World Imagery)
// const SATELLITE_STYLE = {
//   version: 8,
//   sources: {
//     esri: {
//       type: "raster",
//       tiles: [
//         "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
//       ],
//       tileSize: 256,
//       attribution: "Tiles © Esri",
//     },
//   },
//   layers: [
//     {
//       id: "esri-satellite",
//       type: "raster",
//       source: "esri",
//       minzoom: 0,
//       maxzoom: 22,
//     },
//   ],
// };

// const chipStyle = (active) => ({
//   padding: "8px 10px",
//   borderRadius: 999,
//   border: active
//     ? "1px solid rgba(255,255,255,0.45)"
//     : "1px solid rgba(255,255,255,0.18)",
//   background: active ? "rgba(255,255,255,0.12)" : "rgba(15,15,20,0.65)",
//   color: "#fff",
//   fontSize: 12,
//   fontWeight: 800,
//   cursor: "pointer",
//   userSelect: "none",
// });

// const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// const lerp = (a, b, t) => a + (b - a) * t;

// const wrapDeg180 = (deg) => {
//   let d = deg;
//   while (d > 180) d -= 360;
//   while (d < -180) d += 360;
//   return d;
// };

// const lerpAngleDeg = (a, b, t) => {
//   const delta = wrapDeg180(b - a);
//   return a + delta * t;
// };

// const cleanNum = (v) => {
//   if (v == null) return 0;
//   if (typeof v === "number") return v;
//   const n = parseFloat(String(v).replace(/[^0-9.+-]/g, ""));
//   return Number.isNaN(n) ? 0 : n;
// };

// function extractState(maybe) {
//   if (!maybe) return null;

//   const root = maybe?.type && maybe?.data ? maybe.data : maybe;
//   const base = root?.payload ? root.payload : root;
//   const pos = base?.position && typeof base.position === "object" ? base.position : base;

//   const lon = Number(pos.lon ?? pos.lng ?? pos.longitude);
//   const lat = Number(pos.lat ?? pos.latitude);

//   if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

//   return {
//     droneId: base.droneId || base.deviceId || "drone_1",
//     lon,
//     lat,
//     alt: Number(base.alt ?? base.altitude ?? 0),
//     yaw: cleanNum(base.yaw),
//     pitch: cleanNum(base.pitch),
//     roll: cleanNum(base.roll),
//     ts: base.ts || base.timestamp || null,
//     battery: base.battery != null ? cleanNum(base.battery) : undefined,
//     speed: base.speed != null ? cleanNum(base.speed) : undefined,
//   };
// }

// export default function DroneMap({
//   wsUrl: wsUrlProp,
//   autoCenter = true,
//   posSmooth = 0.25,
//   angSmooth = 0.8,
//   camSmooth = 1,
//   modelUrl = `${BASE_PATH}/models/drone.glb`,
// }) {
//   const elRef = useRef(null);
//   const mapRef = useRef(null);
//   const customLayerRef = useRef(null);
//   const mapLoadedRef = useRef(false);

//   // TARGET (from WS)
//   const targetRef = useRef({
//     lon: 46.70191,
//     lat: 24.583282,
//     alt: 80,
//     yaw: 0,
//     pitch: 0,
//     roll: 0,
//   });

//   // SMOOTH (rendered)
//   const smoothRef = useRef({ ...targetRef.current });

//   // Track previous position to compute travel heading
//   const prevPosRef = useRef({ lon: targetRef.current.lon, lat: targetRef.current.lat });
//   const travelYawRef = useRef(0);

//   const manualRotRef = useRef({ yaw: 0, pitch: 0 });

//   const lastCamRef = useRef({
//     lon: 46.70191,
//     lat: 24.583282,
//     bearing: DEFAULT_BEARING,
//     pitch: DEFAULT_PITCH,
//   });

//   const [mode, setMode] = useState("follow");
//   const modeRef = useRef("follow");

//   const [wsStatus, setWsStatus] = useState("DISCONNECTED");

//   const wsUrl = useMemo(() => {
//     if (wsUrlProp) return wsUrlProp;
//     if (typeof window === "undefined") return null;

//     const proto = window.location.protocol === "https:" ? "wss" : "ws";
//     return `${proto}://${window.location.hostname}:5555/ws`;
//   }, [wsUrlProp]);

//   const focusOnDrone = useCallback(() => {
//     const map = mapRef.current;
//     if (!map) return;

//     const { lon, lat } = smoothRef.current;

//     map.flyTo({
//       center: [lon, lat],
//       zoom: FOCUS_ZOOM,
//       pitch: FOCUS_PITCH,
//       bearing: map.getBearing(),
//       duration: 700,
//       essential: true,
//     });
//   }, []);

//   const applyState = useCallback((raw, source) => {
//     const s = extractState(raw);

//     if (!s) {
//       console.warn(`[DroneMap] extractState returned null (source: ${source})`, raw);
//       return;
//     }

//     // Skip invalid position: WS sometimes sends lon=0,lat=0 which would overwrite good coords
//     if (s.lon === 0 && s.lat === 0) return;

//     console.log(`[DroneMap] DATA from backend (source: ${source})`, {
//       lon: s.lon,
//       lat: s.lat,
//       alt: s.alt,
//       yaw: s.yaw,
//       pitch: s.pitch,
//       roll: s.roll,
//       battery: s.battery,
//       speed: s.speed,
//       droneId: s.droneId,
//       ts: s.ts,
//     });

//     targetRef.current.lon = s.lon;
//     targetRef.current.lat = s.lat;
//     targetRef.current.alt = s.alt;
//     targetRef.current.yaw = s.yaw;
//     targetRef.current.pitch = s.pitch;
//     targetRef.current.roll = s.roll;
//   }, []);

//   // Keep a ref to latest applyState so WS effect doesn't depend on it (avoids reconnect on re-render)
//   const applyStateRef = useRef(applyState);
//   applyStateRef.current = applyState;

//   // WS: update targetRef from backend (depends only on wsUrl to avoid unnecessary reconnects)
//   useEffect(() => {
//     if (!wsUrl) return;

//     let shouldReconnect = true;
//     let retry = 0;
//     let ws = null;
//     let reconnectTimer = null;

//     const connect = () => {
//       setWsStatus("CONNECTING");
//       ws = new WebSocket(wsUrl);

//       ws.onopen = () => {
//         retry = 0;
//         setWsStatus("CONNECTED");
//         console.log("[DroneMap] WS connected:", wsUrl);
//       };

//       ws.onclose = () => {
//         setWsStatus("DISCONNECTED");
//         console.log("[DroneMap] WS closed");

//         if (!shouldReconnect) return;

//         retry += 1;
//         const delay = Math.min(15000, 500 * Math.pow(2, retry));
//         console.log(`[DroneMap] WS reconnect in ${delay}ms`);
//         reconnectTimer = setTimeout(connect, delay);
//       };

//       ws.onerror = (e) => {
//         console.log("[DroneMap] WS error:", e);
//         try {
//           ws.close();
//         } catch {}
//       };

//       ws.onmessage = (evt) => {
//         try {
//           const msg = JSON.parse(evt.data);
//           console.log("[DroneMap] WS message received:", msg.type, msg);

//           const apply = applyStateRef.current;

//           if (msg.type === "snapshot") {
//             const rawState =
//               msg.data?.droneState || msg.data?.drone || msg.data?.state || msg.data;
//             apply(rawState, "snapshot");
//             return;
//           }

//           if (msg.type === "drone_state") {
//             apply(msg.data, "drone_state");
//             return;
//           }

//           if (msg.type === "telemetry") {
//             apply(msg.data, "telemetry");
//             return;
//           }

//           apply(msg, "unknown");
//         } catch {
//           // ignore non-json or apply errors
//         }
//       };
//     };

//     connect();

//     return () => {
//       shouldReconnect = false;

//       if (reconnectTimer) clearTimeout(reconnectTimer);

//       try {
//         ws?.close();
//       } catch {}
//     };
//   }, [wsUrl]);

//   // Map init - run once
//   useEffect(() => {
//     if (!elRef.current || mapRef.current) return;

//     const map = new maplibregl.Map({
//       container: elRef.current,
//       style: SATELLITE_STYLE,
//       center: [smoothRef.current.lon, smoothRef.current.lat],
//       zoom: DEFAULT_ZOOM,
//       pitch: DEFAULT_PITCH,
//       bearing: DEFAULT_BEARING,
//       maxZoom: MAX_ZOOM,
//       maxPitch: 85,
//       dragPan: true,
//       touchZoomRotate: true,
//       scrollZoom: true,
//       dragRotate: true,
//       keyboard: true,
//       doubleClickZoom: true,
//       canvasContextAttributes: { antialias: true },
//     });

//     mapRef.current = map;
//     modeRef.current = mode;

//     map.addControl(new maplibregl.NavigationControl(), "top-right");
//     map.on("error", (e) => console.error("MapLibre error:", e?.error || e));

//     if (mode !== "map") {
//       map.dragPan.disable();
//       map.dragRotate.disable();
//     }

//     const canvas = map.getCanvas();

//     let dragging = false;
//     let startX = 0;
//     let startY = 0;
//     let startBearing = 0;
//     let startPitch = 0;
//     let startManYaw = 0;
//     let startManPitch = 0;
//     let dragRaf = 0;
//     let lastDx = 0;
//     let lastDy = 0;

//     const applyDrag = () => {
//       dragRaf = 0;
//       const dx = lastDx;
//       const dy = lastDy;
//       const currentMode = modeRef.current;

//       if (currentMode === "orbit") {
//         const { lon, lat } = smoothRef.current;
//         const bearing = startBearing - dx * 0.25;
//         const pitch = clamp(startPitch + dy * 0.15, 20, 85);
//         map.jumpTo({ center: [lon, lat], bearing, pitch });
//       }

//       if (currentMode === "drone") {
//         manualRotRef.current.yaw = startManYaw - dx * 0.01;
//         manualRotRef.current.pitch = clamp(startManPitch + dy * 0.01, -1.2, 1.2);
//         map.triggerRepaint();
//       }
//     };

//     const onPointerDown = (e) => {
//       const currentMode = modeRef.current;
//       if (currentMode !== "orbit" && currentMode !== "drone") return;

//       dragging = true;
//       startX = e.clientX;
//       startY = e.clientY;
//       startBearing = map.getBearing();
//       startPitch = map.getPitch();
//       startManYaw = manualRotRef.current.yaw;
//       startManPitch = manualRotRef.current.pitch;

//       map.dragPan.disable();
//       map.dragRotate.disable();
//       canvas.setPointerCapture?.(e.pointerId);
//     };

//     const onPointerMove = (e) => {
//       if (!dragging) return;
//       lastDx = e.clientX - startX;
//       lastDy = e.clientY - startY;
//       if (!dragRaf) dragRaf = requestAnimationFrame(applyDrag);
//     };

//     const onPointerUp = () => {
//       dragging = false;
//     };

//     canvas.addEventListener("pointerdown", onPointerDown);
//     window.addEventListener("pointermove", onPointerMove);
//     window.addEventListener("pointerup", onPointerUp);

//     const customLayer = {
//       id: "drone-glb-3d",
//       type: "custom",
//       renderingMode: "3d",

//       onAdd(mapInstance, gl) {
//         this.map = mapInstance;
//         this.camera = new THREE.Camera();
//         this.scene = new THREE.Scene();
//         this.clock = new THREE.Clock();

//         this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));

//         const key = new THREE.DirectionalLight(0xffffff, 1.15);
//         key.position.set(20, -20, 40).normalize();
//         this.scene.add(key);

//         const fill = new THREE.DirectionalLight(0xffffff, 0.65);
//         fill.position.set(-20, 20, 30).normalize();
//         this.scene.add(fill);

//         this.droneGroup = new THREE.Group();
//         this.scene.add(this.droneGroup);

//         this.spinBlades = [];
//         this.propSpin = 22;

//         const makePropeller = () => {
//           const g = new THREE.Group();

//           const hub = new THREE.Mesh(
//             new THREE.CylinderGeometry(0.1, 0.1, 0.06, 24),
//             new THREE.MeshStandardMaterial({
//               color: 0x94a3b8,
//               metalness: 0.6,
//               roughness: 0.3,
//             })
//           );
//           g.add(hub);

//           const bladeMat = new THREE.MeshStandardMaterial({
//             color: 0xcbd5e1,
//             roughness: 0.35,
//             metalness: 0.15,
//           });

//           const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.02, 0.08), bladeMat);
//           blade1.position.y = 0.05;
//           g.add(blade1);

//           const blade2 = blade1.clone();
//           blade2.rotation.y = Math.PI / 2;
//           g.add(blade2);

//           this.spinBlades.push(g);
//           return g;
//         };

//         const manager = new THREE.LoadingManager();
//         manager.setURLModifier((url) => {
//           const file = String(url).split("\\").pop().split("/").pop();
//           if (/\.(png|jpg|jpeg)$/i.test(file)) return `${BASE_PATH}/textures/${file}`;
//           return url;
//         });

//         const loader = new GLTFLoader(manager);

//         this.sizeMeters = 100;
//         this.fanXFactor = 0.42;
//         this.fanZFactor = 0.42;
//         this.fanYFactor = 0.3;
//         this.fanLift = 0.02;

//         loader.load(
//           modelUrl,
//           (gltf) => {
//             this.model = gltf.scene;

//             this.model.traverse((o) => {
//               if (o.isMesh) o.frustumCulled = false;
//             });

//             this.model.updateMatrixWorld(true);

//             let box = new THREE.Box3().setFromObject(this.model);
//             let size = new THREE.Vector3();
//             let center = new THREE.Vector3();

//             box.getSize(size);
//             box.getCenter(center);

//             const maxDim = Math.max(size.x, size.y, size.z) || 1;

//             let unitToMeter = 1;
//             if (maxDim > 1000) unitToMeter = 0.001;
//             else if (maxDim > 100) unitToMeter = 0.01;
//             else if (maxDim > 10) unitToMeter = 0.1;

//             this.model.scale.setScalar(unitToMeter);
//             this.model.updateMatrixWorld(true);

//             box = new THREE.Box3().setFromObject(this.model);
//             box.getCenter(center);
//             this.model.position.sub(center);
//             this.model.updateMatrixWorld(true);

//             box = new THREE.Box3().setFromObject(this.model);
//             box.getSize(size);

//             this.droneGroup.add(this.model);

//             const rx = size.x * this.fanXFactor;
//             const rz = size.z * this.fanZFactor;
//             const ry = -size.y / 2 + size.y * this.fanYFactor;

//             const fanPositions = [
//               new THREE.Vector3(+rx, ry, +rz),
//               new THREE.Vector3(-rx, ry, +rz),
//               new THREE.Vector3(+rx, ry, -rz),
//               new THREE.Vector3(-rx, ry, -rz),
//             ];

//             fanPositions.forEach((p) => {
//               const prop = makePropeller();
//               prop.position.set(p.x, p.y + this.fanLift, p.z);
//               this.droneGroup.add(prop);
//             });

//             console.log("[DroneMap] GLB loaded & attached");
//             this.map.triggerRepaint();
//           },
//           undefined,
//           (err) => console.error("[DroneMap] GLB load error:", err)
//         );

//         this.renderer = new THREE.WebGLRenderer({
//           canvas: mapInstance.getCanvas(),
//           context: gl,
//           antialias: true,
//           alpha: true,
//         });

//         this.renderer.autoClear = false;
//         this.renderer.setClearAlpha(0);
//       },

//       render(gl, matrixOrArgs) {
//         const mainMatrix = Array.isArray(matrixOrArgs)
//           ? matrixOrArgs
//           : matrixOrArgs?.defaultProjectionData?.mainMatrix;

//         if (!mainMatrix) return;

//         let rawDelta = this.clock ? this.clock.getDelta() : 0.016;
//         rawDelta = Math.min(rawDelta, 0.033);

//         const smooth = smoothRef.current;

//         if (this.spinBlades?.length) {
//           for (const g of this.spinBlades) {
//             g.rotation.y += rawDelta * this.propSpin;
//           }
//         }

//         const hover = Math.sin(performance.now() / 350) * 0.6;

//         const mc = maplibregl.MercatorCoordinate.fromLngLat(
//           [smooth.lon, smooth.lat],
//           smooth.alt + hover
//         );

//         const metersToMerc = mc.meterInMercatorCoordinateUnits();
//         const scale = metersToMerc * this.sizeMeters;

//         const man = manualRotRef.current;
//         const isDroneTab = modeRef.current === "drone";
//         // All tabs: default orientation. Only DRONE tab lets user change it via mouse.
//         const pitchRad = isDroneTab ? man.pitch : 0;
//         const yawRad = isDroneTab ? man.yaw : 0;

//         this.droneGroup.rotation.set(pitchRad, 0, yawRad, "XYZ");

//         const rotationAlign = new THREE.Matrix4().makeRotationAxis(
//           new THREE.Vector3(1, 0, 0),
//           Math.PI / 2
//         );

//         const m = new THREE.Matrix4().fromArray(mainMatrix);
//         const l = new THREE.Matrix4()
//           .makeTranslation(mc.x, mc.y, mc.z)
//           .scale(new THREE.Vector3(scale, -scale, scale))
//           .multiply(rotationAlign);

//         this.camera.projectionMatrix = m.multiply(l);

//         this.renderer.resetState();
//         this.renderer.clearDepth();
//         this.renderer.render(this.scene, this.camera);

//         this.map.triggerRepaint();
//       },
//     };

//     customLayerRef.current = customLayer;

//     const onLoad = () => {
//       mapLoadedRef.current = true;

//       if (!map.getLayer("drone-glb-3d")) {
//         map.addLayer(customLayer);
//       }

//       map.triggerRepaint();
//     };

//     if (map.isStyleLoaded()) {
//       onLoad();
//     } else {
//       map.once("load", onLoad);
//     }

//     return () => {
//       if (dragRaf) cancelAnimationFrame(dragRaf);

//       canvas.removeEventListener("pointerdown", onPointerDown);
//       window.removeEventListener("pointermove", onPointerMove);
//       window.removeEventListener("pointerup", onPointerUp);

//       mapLoadedRef.current = false;
//       customLayerRef.current = null;
//       mapRef.current = null;

//       try {
//         map.remove();
//       } catch {}
//     };
//   }, [modelUrl, posSmooth, angSmooth]);

//   // Single animation tick: update smoothRef then set map + trigger repaint so drone and map use same position (same speed)
//   useEffect(() => {
//     let rafId = 0;
//     let lastTime = 0;

//     const tick = (time) => {
//       rafId = requestAnimationFrame(tick);

//       const map = mapRef.current;
//       const now = time * 0.001;
//       const rawDelta = lastTime > 0 ? Math.min(now - lastTime, 0.1) : 0.016;
//       lastTime = now;

//       const target = targetRef.current;
//       const smooth = smoothRef.current;

//       const kPos = 1 - Math.exp(-rawDelta * posSmooth);
//       const kAng = 1 - Math.exp(-rawDelta * angSmooth);

//       // Cap max position change per frame to prevent jumps (approx 0.0001 deg ~ 11m)
//       const maxStep = 0.00003;
//       const dlat = clamp((target.lat - smooth.lat) * kPos, -maxStep, maxStep);
//       const dlon = clamp((target.lon - smooth.lon) * kPos, -maxStep, maxStep);
//       const dalt = clamp((target.alt - smooth.alt) * kPos, -2, 2);

//       smooth.lon += dlon;
//       smooth.lat += dlat;
//       smooth.alt += dalt;

//       // Compute heading from actual movement direction
//       const prev = prevPosRef.current;
//       const moveDlon = smooth.lon - prev.lon;
//       const moveDlat = smooth.lat - prev.lat;
//       const moveDist = Math.sqrt(moveDlon * moveDlon + moveDlat * moveDlat);

//       if (moveDist > 1e-8) {
//         const bearing = Math.atan2(moveDlon, moveDlat) * (180 / Math.PI);
//         travelYawRef.current = bearing;
//       }
//       prevPosRef.current = { lon: smooth.lon, lat: smooth.lat };

//       smooth.yaw = lerpAngleDeg(smooth.yaw, travelYawRef.current, kAng);
//       smooth.pitch = lerpAngleDeg(smooth.pitch, target.pitch, kAng);
//       smooth.roll = lerpAngleDeg(smooth.roll, target.roll, kAng);

//       if (map && autoCenter) {
//         const currentMode = modeRef.current;
//         if (currentMode === "follow") {
//           const { lon, lat, yaw } = smooth;
//           lastCamRef.current = { lon, lat, bearing: yaw, pitch: FOCUS_PITCH };
//           map.easeTo({ center: [lon, lat], bearing: yaw, pitch: FOCUS_PITCH, duration: 80, essential: true });
//         } else if (currentMode === "orbit") {
//           const { lon, lat } = smooth;
//           map.setCenter([lon, lat]);
//         }
//       }

//       if (map && customLayerRef.current) {
//         map.triggerRepaint();
//       }
//     };

//     rafId = requestAnimationFrame(tick);

//     return () => {
//       cancelAnimationFrame(rafId);
//     };
//   }, [autoCenter, posSmooth, angSmooth]);

//   // Mode handling
//   useEffect(() => {
//     modeRef.current = mode;

//     if (mode === "drone") {
//       manualRotRef.current.yaw = 0;
//       manualRotRef.current.pitch = 0;
//     }

//     const map = mapRef.current;
//     if (!map) return;

//     if (mode === "map") {
//       map.dragPan.enable();
//       map.dragRotate.enable();
//     } else if (mode === "orbit" || mode === "drone") {
//       map.dragPan.disable();
//       map.dragRotate.enable();
//     } else {
//       map.dragPan.disable();
//       map.dragRotate.disable();
//     }
//   }, [mode]);

//   const badge = useMemo(() => {
//     const isOn = wsStatus === "CONNECTED";

//     return {
//       text: wsStatus,
//       color: isOn ? "#2dff88" : wsStatus === "CONNECTING" ? "#ffcc00" : "#ff4d6d",
//       glow: isOn
//         ? "0 0 18px rgba(45,255,136,0.35)"
//         : wsStatus === "CONNECTING"
//         ? "0 0 18px rgba(255,204,0,0.25)"
//         : "0 0 18px rgba(255,77,109,0.25)",
//     };
//   }, [wsStatus]);

//   return (
//     <div
//       style={{
//         position: "relative",
//         height: "100%",
//         width: "100%",
//         minHeight: 400,
//         borderRadius: 16,
//         overflow: "hidden",
//         border: "1px solid rgba(255,255,255,0.12)",
//       }}
//     >
//       <div
//         ref={elRef}
//         style={{
//           position: "absolute",
//           inset: 0,
//           width: "100%",
//           height: "100%",
//         }}
//       />

//       {/* Controls */}
//       <div
//         style={{
//           position: "absolute",
//           left: 12,
//           top: 12,
//           display: "flex",
//           gap: 8,
//           zIndex: 10,
//           padding: 8,
//           borderRadius: 14,
//           background: "rgba(10, 12, 18, 0.55)",
//           border: "1px solid rgba(255,255,255,0.12)",
//           backdropFilter: "blur(10px)",
//         }}
//       >
//         <button type="button" onClick={() => setMode("map")} style={chipStyle(mode === "map")}>
//           MAP
//         </button>

//         <button
//           type="button"
//           onClick={() => setMode("follow")}
//           style={chipStyle(mode === "follow")}
//         >
//           FOLLOW
//         </button>

//         <button
//           type="button"
//           onClick={() => setMode("orbit")}
//           style={chipStyle(mode === "orbit")}
//         >
//           ORBIT
//         </button>

//         <button
//           type="button"
//           onClick={() => setMode("drone")}
//           style={chipStyle(mode === "drone")}
//         >
//           DRONE
//         </button>

//         <button
//           type="button"
//           onClick={focusOnDrone}
//           style={{ ...chipStyle(false), fontWeight: 900, marginLeft: 6 }}
//         >
//           Focus
//         </button>
//       </div>

//       {/* WS Status */}
//       <div
//         style={{
//           position: "absolute",
//           right: 12,
//           top: 12,
//           zIndex: 10,
//           padding: "8px 10px",
//           borderRadius: 999,
//           background: "rgba(10, 12, 18, 0.55)",
//           border: "1px solid rgba(255,255,255,0.12)",
//           backdropFilter: "blur(10px)",
//           color: "#fff",
//           display: "flex",
//           alignItems: "center",
//           gap: 8,
//           fontSize: 12,
//           fontWeight: 900,
//         }}
//         data-testid="ws-status"
//       >
//         <span
//           style={{
//             width: 10,
//             height: 10,
//             borderRadius: 999,
//             background: badge.color,
//             boxShadow: badge.glow,
//             display: "inline-block",
//           }}
//         />
//         {badge.text}
//       </div>
//     </div>
//   );
// }


"use client";

import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import maplibregl from "maplibre-gl";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";

const BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH || "";

// Camera defaults
const DEFAULT_ZOOM = 18;
const DEFAULT_PITCH = 72;
const DEFAULT_BEARING = -22;
const MAX_ZOOM = 22;

const FOCUS_ZOOM = 19;
const FOCUS_PITCH = 75;

// Satellite style (Esri World Imagery)
const SATELLITE_STYLE = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri",
    },
  },
  layers: [
    {
      id: "esri-satellite",
      type: "raster",
      source: "esri",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const chipStyle = (active) => ({
  padding: "8px 10px",
  borderRadius: 999,
  border: active
    ? "1px solid rgba(255,255,255,0.45)"
    : "1px solid rgba(255,255,255,0.18)",
  background: active ? "rgba(255,255,255,0.12)" : "rgba(15,15,20,0.65)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  userSelect: "none",
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

const wrapDeg180 = (deg) => {
  let d = deg;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
};

const lerpAngleDeg = (a, b, t) => {
  const delta = wrapDeg180(b - a);
  return a + delta * t;
};

const cleanNum = (v) => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[^0-9.+-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
};

// changed: helper for T3 timing conversion
const toMs = (v) => {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;

  if (typeof v === "string") {
    const trimmed = v.trim();
    const maybeNumber = Number(trimmed);
    if (Number.isFinite(maybeNumber) && trimmed !== "") return maybeNumber;
  }

  const parsed = new Date(v).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

// changed: helper for T3 summary stats
const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
};

// changed: helper for T3 summary stats
const avg = (arr) => {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

function extractState(maybe) {
  if (!maybe) return null;

  const root = maybe?.type && maybe?.data ? maybe.data : maybe;
  const base = root?.payload ? root.payload : root;
  const pos = base?.position && typeof base.position === "object" ? base.position : base;

  const lon = Number(pos.lon ?? pos.lng ?? pos.longitude);
  const lat = Number(pos.lat ?? pos.latitude);

  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  return {
    droneId: base.droneId || base.deviceId || "drone_1",
    lon,
    lat,
    alt: Number(base.alt ?? base.altitude ?? 0),
    yaw: cleanNum(base.yaw),
    pitch: cleanNum(base.pitch),
    roll: cleanNum(base.roll),
    ts: base.ts || base.timestamp || null,
    battery: base.battery != null ? cleanNum(base.battery) : undefined,
    speed: base.speed != null ? cleanNum(base.speed) : undefined,
  };
}

export default function DroneMap({
  wsUrl: wsUrlProp,
  autoCenter = true,
  posSmooth = 0.25,
  angSmooth = 0.8,
  camSmooth = 1,
  modelUrl = `${BASE_PATH}/models/drone1.glb`,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const customLayerRef = useRef(null);
  const mapLoadedRef = useRef(false);

  // TARGET (from WS)
  const targetRef = useRef({
    lon: 46.70191,
    lat: 24.583282,
    alt: 80,
    yaw: 0,
    pitch: 0,
    roll: 0,
  });

  // SMOOTH (rendered)
  const smoothRef = useRef({ ...targetRef.current });

  // Track previous position to compute travel heading
  const prevPosRef = useRef({ lon: targetRef.current.lon, lat: targetRef.current.lat });
  const travelYawRef = useRef(0);

  const manualRotRef = useRef({ yaw: 0, pitch: 0 });

  const lastCamRef = useRef({
    lon: 46.70191,
    lat: 24.583282,
    bearing: DEFAULT_BEARING,
    pitch: DEFAULT_PITCH,
  });

  const [mode, setMode] = useState("follow");
  const modeRef = useRef("follow");

  const [wsStatus, setWsStatus] = useState("DISCONNECTED");

  // UC8-T3: render latency + visualization diagnostics (map WS path)
  const pendingRenderRef = useRef(null);
  const t3SamplesRef = useRef([]);
  const [t3Last, setT3Last] = useState(null);
  const lastDronePacketAtRef = useRef(null);
  const vizArrivalRef = useRef([]);
  const [vizHz, setVizHz] = useState(0);
  const [packetAgeMs, setPacketAgeMs] = useState(null);

  const pruneVizArrivals = useCallback(() => {
    const now = Date.now();
    vizArrivalRef.current = vizArrivalRef.current.filter((t) => now - t <= 1000);
    setVizHz(vizArrivalRef.current.length);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const at = lastDronePacketAtRef.current;
      setPacketAgeMs(at != null ? Date.now() - at : null);
      pruneVizArrivals();
    }, 200);
    return () => clearInterval(id);
  }, [pruneVizArrivals]);

  const wsUrl = useMemo(() => {
    if (wsUrlProp) return wsUrlProp;
    if (typeof window === "undefined") return null;

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.hostname}:5555/ws`;
  }, [wsUrlProp]);

  const focusOnDrone = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const { lon, lat } = smoothRef.current;

    map.flyTo({
      center: [lon, lat],
      zoom: FOCUS_ZOOM,
      pitch: FOCUS_PITCH,
      bearing: map.getBearing(),
      duration: 700,
      essential: true,
    });
  }, []);

  const applyState = useCallback((raw, source) => {
    const s = extractState(raw);

    if (!s) {
      console.warn(`[DroneMap] extractState returned null (source: ${source})`, raw);
      return;
    }

    // Skip invalid position: WS sometimes sends lon=0,lat=0 which would overwrite good coords
    if (s.lon === 0 && s.lat === 0) return;

    if (source === "drone_state") {
      const now = Date.now();
      lastDronePacketAtRef.current = now;
      vizArrivalRef.current.push(now);
      vizArrivalRef.current = vizArrivalRef.current.filter((t) => now - t <= 1000);
      setVizHz(vizArrivalRef.current.length);
    }

    // console.log(`[DroneMap] DATA from backend (source: ${source})`, {
    //   lon: s.lon,
    //   lat: s.lat,
    //   alt: s.alt,
    //   yaw: s.yaw,
    //   pitch: s.pitch,
    //   roll: s.roll,
    //   battery: s.battery,
    //   speed: s.speed,
    //   droneId: s.droneId,
    //   ts: s.ts,
    // });

    targetRef.current.lon = s.lon;
    targetRef.current.lat = s.lat;
    targetRef.current.alt = s.alt;
    targetRef.current.yaw = s.yaw;
    targetRef.current.pitch = s.pitch;
    targetRef.current.roll = s.roll;
  }, []);

  // Keep a ref to latest applyState so WS effect doesn't depend on it (avoids reconnect on re-render)
  const applyStateRef = useRef(applyState);
  applyStateRef.current = applyState;

  // changed: browser export helpers for T3 evidence
  useEffect(() => {
    if (typeof window === "undefined") return;

    window.exportT3Report = () => {
      const rows = t3SamplesRef.current || [];

      const renderLatencies = rows.map((r) => r.render_latency_ms).filter(Number.isFinite);
      const wsLatencies = rows.map((r) => r.ws_latency_ms).filter(Number.isFinite);
      const frontendDelays = rows.map((r) => r.frontend_delay_ms).filter(Number.isFinite);

      const summary = {
        sample_count: rows.length,
        avg_render_latency_ms: Number(avg(renderLatencies).toFixed(2)),
        p95_render_latency_ms: Number(percentile(renderLatencies, 95).toFixed(2)),
        max_render_latency_ms: Number(
          (renderLatencies.length ? Math.max(...renderLatencies) : 0).toFixed(2)
        ),
        avg_ws_latency_ms: Number(avg(wsLatencies).toFixed(2)),
        avg_frontend_delay_ms: Number(avg(frontendDelays).toFixed(2)),
        exported_at: new Date().toISOString(),
      };

      const csvHeader = [
        "received_iso",
        "source_ts_ms",
        "received_ts_ms",
        "render_ts_ms",
        "ws_latency_ms",
        "frontend_delay_ms",
        "render_latency_ms",
        "droneId",
        "target_lon",
        "target_lat",
      ].join(",");

      const csvRows = rows.map((r) =>
        [
          r.received_iso,
          r.source_ts_ms,
          r.received_ts_ms,
          r.render_ts_ms,
          r.ws_latency_ms,
          r.frontend_delay_ms,
          r.render_latency_ms,
          r.droneId,
          r.target_lon,
          r.target_lat,
        ].join(",")
      );

      const csv = [csvHeader, ...csvRows].join("\n");

      const csvBlob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const jsonBlob = new Blob([JSON.stringify({ summary, rows }, null, 2)], {
        type: "application/json;charset=utf-8;",
      });

      const ts = new Date().toISOString().replace(/[:.]/g, "-");

      const csvUrl = URL.createObjectURL(csvBlob);
      const jsonUrl = URL.createObjectURL(jsonBlob);

      const a1 = document.createElement("a");
      a1.href = csvUrl;
      a1.download = `uc8_t3_render_latency_${ts}.csv`;
      a1.click();

      const a2 = document.createElement("a");
      a2.href = jsonUrl;
      a2.download = `uc8_t3_render_latency_${ts}.json`;
      a2.click();

      // console.log("[UC8-T3] summary", summary);
      return summary;
    };

    window.getT3Summary = () => {
      const rows = t3SamplesRef.current || [];
      const renderLatencies = rows.map((r) => r.render_latency_ms).filter(Number.isFinite);
      const wsLatencies = rows.map((r) => r.ws_latency_ms).filter(Number.isFinite);
      const frontendDelays = rows.map((r) => r.frontend_delay_ms).filter(Number.isFinite);

      return {
        sample_count: rows.length,
        avg_render_latency_ms: Number(avg(renderLatencies).toFixed(2)),
        p95_render_latency_ms: Number(percentile(renderLatencies, 95).toFixed(2)),
        max_render_latency_ms: Number(
          (renderLatencies.length ? Math.max(...renderLatencies) : 0).toFixed(2)
        ),
        avg_ws_latency_ms: Number(avg(wsLatencies).toFixed(2)),
        avg_frontend_delay_ms: Number(avg(frontendDelays).toFixed(2)),
      };
    };

    return () => {
      delete window.exportT3Report;
      delete window.getT3Summary;
    };
  }, []);

  // WS: update targetRef from backend (depends only on wsUrl to avoid unnecessary reconnects)
  useEffect(() => {
    if (!wsUrl) return;

    let shouldReconnect = true;
    let retry = 0;
    let ws = null;
    let reconnectTimer = null;

    const connect = () => {
      setWsStatus("CONNECTING");
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        retry = 0;
        setWsStatus("CONNECTED");
        console.log("[DroneMap] WS connected:", wsUrl);
      };

      ws.onclose = () => {
        setWsStatus("DISCONNECTED");
        lastDronePacketAtRef.current = null;
        vizArrivalRef.current = [];
        setVizHz(0);
        setPacketAgeMs(null);
        console.log("[DroneMap] WS closed");

        if (!shouldReconnect) return;

        retry += 1;
        const delay = Math.min(15000, 500 * Math.pow(2, retry));
        console.log(`[DroneMap] WS reconnect in ${delay}ms`);
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = (e) => {
        console.log("[DroneMap] WS error:", e);
        try {
          ws.close();
        } catch {}
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          // console.log("[DroneMap] WS message received:", msg.type, msg);

          const apply = applyStateRef.current;

          if (msg.type === "snapshot") {
            const rawState =
              msg.data?.droneState || msg.data?.drone || msg.data?.state || msg.data;
            apply(rawState, "snapshot");
            return;
          }

          if (msg.type === "drone_state") {
            // changed: capture T3 timing candidate before applying new target state
            const s = extractState(msg.data);

            if (s) {
              const sourceTsMs = toMs(s.ts);
              const receivedTsMs = Date.now();

              const startDistance = Math.hypot(
                smoothRef.current.lon - s.lon,
                smoothRef.current.lat - s.lat
              );

              const startPitchGap = Math.abs((smoothRef.current.pitch || 0) - (s.pitch || 0));
              const startRollGap = Math.abs((smoothRef.current.roll || 0) - (s.roll || 0));

              pendingRenderRef.current = {
                droneId: s.droneId,
                sourceTsMs,
                receivedTsMs,
                receivedIso: new Date(receivedTsMs).toISOString(),
                target_lon: s.lon,
                target_lat: s.lat,
                target_pitch: s.pitch || 0,
                target_roll: s.roll || 0,
                startDistance,
                startPitchGap,
                startRollGap,
              };
            }

            apply(msg.data, "drone_state");
            return;
          }

          if (msg.type === "telemetry") {
            apply(msg.data, "telemetry");
            return;
          }

          apply(msg, "unknown");
        } catch {
          // ignore non-json or apply errors
        }
      };
    };

    connect();

    return () => {
      shouldReconnect = false;

      if (reconnectTimer) clearTimeout(reconnectTimer);

      try {
        ws?.close();
      } catch {}
    };
  }, [wsUrl]);

  // Map init - run once
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: elRef.current,
      style: SATELLITE_STYLE,
      center: [smoothRef.current.lon, smoothRef.current.lat],
      zoom: DEFAULT_ZOOM,
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      maxZoom: MAX_ZOOM,
      maxPitch: 85,
      dragPan: true,
      touchZoomRotate: true,
      scrollZoom: true,
      dragRotate: true,
      keyboard: true,
      doubleClickZoom: true,
      canvasContextAttributes: { antialias: true },
    });

    mapRef.current = map;
    modeRef.current = mode;

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("error", (e) => console.error("MapLibre error:", e?.error || e));

    if (mode !== "map") {
      map.dragPan.disable();
      map.dragRotate.disable();
    }

    const canvas = map.getCanvas();

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startBearing = 0;
    let startPitch = 0;
    let startManYaw = 0;
    let startManPitch = 0;
    let dragRaf = 0;
    let lastDx = 0;
    let lastDy = 0;

    const applyDrag = () => {
      dragRaf = 0;
      const dx = lastDx;
      const dy = lastDy;
      const currentMode = modeRef.current;

      if (currentMode === "orbit") {
        const { lon, lat } = smoothRef.current;
        const bearing = startBearing - dx * 0.25;
        const pitch = clamp(startPitch + dy * 0.15, 20, 85);
        map.jumpTo({ center: [lon, lat], bearing, pitch });
      }

      if (currentMode === "drone") {
        manualRotRef.current.yaw = startManYaw - dx * 0.01;
        manualRotRef.current.pitch = clamp(startManPitch + dy * 0.01, -1.2, 1.2);
        map.triggerRepaint();
      }
    };

    const onPointerDown = (e) => {
      const currentMode = modeRef.current;
      if (currentMode !== "orbit" && currentMode !== "drone") return;

      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startBearing = map.getBearing();
      startPitch = map.getPitch();
      startManYaw = manualRotRef.current.yaw;
      startManPitch = manualRotRef.current.pitch;

      map.dragPan.disable();
      map.dragRotate.disable();
      canvas.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      lastDx = e.clientX - startX;
      lastDy = e.clientY - startY;
      if (!dragRaf) dragRaf = requestAnimationFrame(applyDrag);
    };

    const onPointerUp = () => {
      dragging = false;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    const customLayer = {
      id: "drone-glb-3d",
      type: "custom",
      renderingMode: "3d",

      onAdd(mapInstance, gl) {
        this.map = mapInstance;
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));

        const key = new THREE.DirectionalLight(0xffffff, 1.15);
        key.position.set(20, -20, 40).normalize();
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0xffffff, 0.65);
        fill.position.set(-20, 20, 30).normalize();
        this.scene.add(fill);

        this.droneGroup = new THREE.Group();
        this.scene.add(this.droneGroup);

        this.spinBlades = [];
        this.propSpin = 22;

        const makePropeller = () => {
          const g = new THREE.Group();

          const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.06, 24),
            new THREE.MeshStandardMaterial({
              color: 0x94a3b8,
              metalness: 0.6,
              roughness: 0.3,
            })
          );
          g.add(hub);

          const bladeMat = new THREE.MeshStandardMaterial({
            color: 0xcbd5e1,
            roughness: 0.35,
            metalness: 0.15,
          });

          const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.02, 0.08), bladeMat);
          blade1.position.y = 0.05;
          g.add(blade1);

          const blade2 = blade1.clone();
          blade2.rotation.y = Math.PI / 2;
          g.add(blade2);

          this.spinBlades.push(g);
          return g;
        };

        const manager = new THREE.LoadingManager();
        manager.setURLModifier((url) => {
          const file = String(url).split("\\").pop().split("/").pop();
          if (/\.(png|jpg|jpeg)$/i.test(file)) return `${BASE_PATH}/textures/${file}`;
          return url;
        });

        const loader = new GLTFLoader(manager);

        this.sizeMeters = 100;
        this.fanXFactor = 0.42;
        this.fanZFactor = 0.42;
        this.fanYFactor = 0.3;
        this.fanLift = 0.02;

        loader.load(
          modelUrl,
          (gltf) => {
            this.model = gltf.scene;

            this.model.traverse((o) => {
              if (o.isMesh) o.frustumCulled = false;
            });

            this.model.updateMatrixWorld(true);

            let box = new THREE.Box3().setFromObject(this.model);
            let size = new THREE.Vector3();
            let center = new THREE.Vector3();

            box.getSize(size);
            box.getCenter(center);

            const maxDim = Math.max(size.x, size.y, size.z) || 1;

            let unitToMeter = 1;
            if (maxDim > 1000) unitToMeter = 0.001;
            else if (maxDim > 100) unitToMeter = 0.01;
            else if (maxDim > 10) unitToMeter = 0.1;

            this.model.scale.setScalar(unitToMeter);
            this.model.updateMatrixWorld(true);

            box = new THREE.Box3().setFromObject(this.model);
            box.getCenter(center);
            this.model.position.sub(center);
            this.model.updateMatrixWorld(true);

            box = new THREE.Box3().setFromObject(this.model);
            box.getSize(size);

            this.droneGroup.add(this.model);

            const rx = size.x * this.fanXFactor;
            const rz = size.z * this.fanZFactor;
            const ry = -size.y / 2 + size.y * this.fanYFactor;

            const fanPositions = [
              new THREE.Vector3(+rx, ry, +rz),
              new THREE.Vector3(-rx, ry, +rz),
              new THREE.Vector3(+rx, ry, -rz),
              new THREE.Vector3(-rx, ry, -rz),
            ];

            fanPositions.forEach((p) => {
              const prop = makePropeller();
              prop.position.set(p.x, p.y + this.fanLift, p.z);
              this.droneGroup.add(prop);
            });

            console.log("[DroneMap] GLB loaded & attached");
            this.map.triggerRepaint();
          },
          undefined,
          (err) => console.error("[DroneMap] GLB load error:", err)
        );

        this.renderer = new THREE.WebGLRenderer({
          canvas: mapInstance.getCanvas(),
          context: gl,
          antialias: true,
          alpha: true,
        });

        this.renderer.autoClear = false;
        this.renderer.setClearAlpha(0);
      },

      render(gl, matrixOrArgs) {
        const mainMatrix = Array.isArray(matrixOrArgs)
          ? matrixOrArgs
          : matrixOrArgs?.defaultProjectionData?.mainMatrix;

        if (!mainMatrix) return;

        let rawDelta = this.clock ? this.clock.getDelta() : 0.016;
        rawDelta = Math.min(rawDelta, 0.033);

        const smooth = smoothRef.current;

        if (this.spinBlades?.length) {
          for (const g of this.spinBlades) {
            g.rotation.y += rawDelta * this.propSpin;
          }
        }

        const hover = Math.sin(performance.now() / 350) * 0.6;

        const mc = maplibregl.MercatorCoordinate.fromLngLat(
          [smooth.lon, smooth.lat],
          smooth.alt + hover
        );

        const metersToMerc = mc.meterInMercatorCoordinateUnits();
        const scale = metersToMerc * this.sizeMeters;

        const man = manualRotRef.current;
        const isDroneTab = modeRef.current === "drone";
        // All tabs: default orientation. Only DRONE tab lets user change it via mouse.
        const pitchRad = isDroneTab ? man.pitch : 0;
        const yawRad = isDroneTab ? man.yaw : 0;

        this.droneGroup.rotation.set(pitchRad, 0, yawRad, "XYZ");

        const rotationAlign = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(1, 0, 0),
          Math.PI / 2
        );

        const m = new THREE.Matrix4().fromArray(mainMatrix);
        const l = new THREE.Matrix4()
          .makeTranslation(mc.x, mc.y, mc.z)
          .scale(new THREE.Vector3(scale, -scale, scale))
          .multiply(rotationAlign);

        this.camera.projectionMatrix = m.multiply(l);

        this.renderer.resetState();
        this.renderer.clearDepth();
        this.renderer.render(this.scene, this.camera);

        this.map.triggerRepaint();
      },
    };

    customLayerRef.current = customLayer;

    const onLoad = () => {
      mapLoadedRef.current = true;

      if (!map.getLayer("drone-glb-3d")) {
        map.addLayer(customLayer);
      }

      map.triggerRepaint();
    };

    if (map.isStyleLoaded()) {
      onLoad();
    } else {
      map.once("load", onLoad);
    }

    return () => {
      if (dragRaf) cancelAnimationFrame(dragRaf);

      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      mapLoadedRef.current = false;
      customLayerRef.current = null;
      mapRef.current = null;

      try {
        map.remove();
      } catch {}
    };
  }, [modelUrl, posSmooth, angSmooth]);

  // Single animation tick: update smoothRef then set map + trigger repaint so drone and map use same position (same speed)
  useEffect(() => {
    let rafId = 0;
    let lastTime = 0;

    const tick = (time) => {
      rafId = requestAnimationFrame(tick);

      const map = mapRef.current;
      const now = time * 0.001;
      const rawDelta = lastTime > 0 ? Math.min(now - lastTime, 0.1) : 0.016;
      lastTime = now;

      const target = targetRef.current;
      const smooth = smoothRef.current;

      const kPos = 1 - Math.exp(-rawDelta * posSmooth);
      const kAng = 1 - Math.exp(-rawDelta * angSmooth);

      // Cap max position change per frame to prevent jumps (approx 0.0001 deg ~ 11m)
      const maxStep = 0.00003;
      const dlat = clamp((target.lat - smooth.lat) * kPos, -maxStep, maxStep);
      const dlon = clamp((target.lon - smooth.lon) * kPos, -maxStep, maxStep);
      const dalt = clamp((target.alt - smooth.alt) * kPos, -2, 2);

      smooth.lon += dlon;
      smooth.lat += dlat;
      smooth.alt += dalt;

      // Compute heading from actual movement direction
      const prev = prevPosRef.current;
      const moveDlon = smooth.lon - prev.lon;
      const moveDlat = smooth.lat - prev.lat;
      const moveDist = Math.sqrt(moveDlon * moveDlon + moveDlat * moveDlat);

      if (moveDist > 1e-8) {
        const bearing = Math.atan2(moveDlon, moveDlat) * (180 / Math.PI);
        travelYawRef.current = bearing;
      }
      prevPosRef.current = { lon: smooth.lon, lat: smooth.lat };

      smooth.yaw = lerpAngleDeg(smooth.yaw, travelYawRef.current, kAng);
      smooth.pitch = lerpAngleDeg(smooth.pitch, target.pitch, kAng);
      smooth.roll = lerpAngleDeg(smooth.roll, target.roll, kAng);

      // changed: UC8-T3 first visible render detection
      const pending = pendingRenderRef.current;
      if (pending) {
        const distNow = Math.hypot(
          smooth.lon - pending.target_lon,
          smooth.lat - pending.target_lat
        );

        const pitchGapNow = Math.abs((smooth.pitch || 0) - (pending.target_pitch || 0));
        const rollGapNow = Math.abs((smooth.roll || 0) - (pending.target_roll || 0));

        const movedTowardTarget =
          distNow < pending.startDistance - 1e-10 ||
          pitchGapNow < pending.startPitchGap - 0.01 ||
          rollGapNow < pending.startRollGap - 0.01;

        if (movedTowardTarget) {
          const renderTsMs = Date.now();

          const sample = {
            received_iso: pending.receivedIso,
            source_ts_ms: pending.sourceTsMs,
            received_ts_ms: pending.receivedTsMs,
            render_ts_ms: renderTsMs,
            ws_latency_ms:
              pending.sourceTsMs != null
                ? Number((pending.receivedTsMs - pending.sourceTsMs).toFixed(2))
                : null,
            frontend_delay_ms: Number((renderTsMs - pending.receivedTsMs).toFixed(2)),
            render_latency_ms:
              pending.sourceTsMs != null
                ? Number((renderTsMs - pending.sourceTsMs).toFixed(2))
                : null,
            droneId: pending.droneId,
            target_lon: pending.target_lon,
            target_lat: pending.target_lat,
          };

          t3SamplesRef.current.push(sample);
          setT3Last(sample);

          console.log(
            "[UC8-T3 render]",
            sample.received_iso,
            "render_latency_ms=",
            sample.render_latency_ms,
            "frontend_delay_ms=",
            sample.frontend_delay_ms,
            "ws_latency_ms=",
            sample.ws_latency_ms
          );

          pendingRenderRef.current = null;
        }
      }

      if (map && autoCenter) {
        const currentMode = modeRef.current;
        if (currentMode === "follow") {
          const { lon, lat, yaw } = smooth;
          lastCamRef.current = { lon, lat, bearing: yaw, pitch: FOCUS_PITCH };
          map.easeTo({
            center: [lon, lat],
            bearing: yaw,
            pitch: FOCUS_PITCH,
            duration: 80,
            essential: true,
          });
        } else if (currentMode === "orbit") {
          const { lon, lat } = smooth;
          map.setCenter([lon, lat]);
        }
      }

      if (map && customLayerRef.current) {
        map.triggerRepaint();
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [autoCenter, posSmooth, angSmooth, camSmooth]);

  // Mode handling
  useEffect(() => {
    modeRef.current = mode;

    if (mode === "drone") {
      manualRotRef.current.yaw = 0;
      manualRotRef.current.pitch = 0;
    }

    const map = mapRef.current;
    if (!map) return;

    if (mode === "map") {
      map.dragPan.enable();
      map.dragRotate.enable();
    } else if (mode === "orbit" || mode === "drone") {
      map.dragPan.disable();
      map.dragRotate.enable();
    } else {
      map.dragPan.disable();
      map.dragRotate.disable();
    }
  }, [mode]);

  const badge = useMemo(() => {
    const isOn = wsStatus === "CONNECTED";

    return {
      text: wsStatus,
      color: isOn ? "#2dff88" : wsStatus === "CONNECTING" ? "#ffcc00" : "#ff4d6d",
      glow: isOn
        ? "0 0 18px rgba(45,255,136,0.35)"
        : wsStatus === "CONNECTING"
        ? "0 0 18px rgba(255,204,0,0.25)"
        : "0 0 18px rgba(255,77,109,0.25)",
    };
  }, [wsStatus]);

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        minHeight: 400,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div
        ref={elRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      />

      {/* Controls */}
      <div
        style={{
          position: "absolute",
          left: 12,
          top: 12,
          display: "flex",
          gap: 8,
          zIndex: 10,
          padding: 8,
          borderRadius: 14,
          background: "rgba(10, 12, 18, 0.55)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(10px)",
        }}
      >
        <button type="button" onClick={() => setMode("map")} style={chipStyle(mode === "map")}>
          MAP
        </button>

        <button
          type="button"
          onClick={() => setMode("follow")}
          style={chipStyle(mode === "follow")}
        >
          FOLLOW
        </button>

        <button
          type="button"
          onClick={() => setMode("orbit")}
          style={chipStyle(mode === "orbit")}
        >
          ORBIT
        </button>

        <button
          type="button"
          onClick={() => setMode("drone")}
          style={chipStyle(mode === "drone")}
        >
          DRONE
        </button>

        <button
          type="button"
          onClick={focusOnDrone}
          style={{ ...chipStyle(false), fontWeight: 900, marginLeft: 6 }}
        >
          Focus
        </button>
      </div>

      {/* UC8-T3 visualization diagnostics (map WebSocket + first smoothed render) */}
      <div
        data-testid="viz-diagnostics-t3"
        style={{
          position: "absolute",
          right: 12,
          top: 12,
          zIndex: 10,
          minWidth: 148,
          padding: "10px 12px",
          borderRadius: 14,
          background: "rgba(10, 12, 18, 0.72)",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(12px)",
          color: "#e2e8f0",
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1.45,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <div
          style={{
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: "0.08em",
            color: "#64748b",
            marginBottom: 6,
          }}
        >
          T3 · VISUALIZATION
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: badge.color,
              boxShadow: badge.glow,
              flexShrink: 0,
            }}
          />
          <span style={{ color: "#94a3b8", width: 52 }}>WS</span>
          <span data-testid="ws-status" style={{ color: badge.color, fontWeight: 800 }}>
            {badge.text}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 2 }}>
          <span style={{ color: "#94a3b8", width: 52 }}>Last Δ</span>
          <span style={{ color: "#cbd5e1", fontWeight: 700 }}>
            {packetAgeMs != null ? `${Math.round(packetAgeMs)} ms` : "—"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 2 }}>
          <span style={{ color: "#94a3b8", width: 52 }}>Rate</span>
          <span style={{ color: "#cbd5e1", fontWeight: 700 }}>{vizHz} /s</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ color: "#94a3b8", width: 52 }}>Render</span>
          <span style={{ color: "#2dd4bf", fontWeight: 700 }}>
            {t3Last?.render_latency_ms != null ? `${t3Last.render_latency_ms} ms` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}