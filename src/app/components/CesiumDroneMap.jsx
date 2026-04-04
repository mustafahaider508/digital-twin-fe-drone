"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";

/**
 * Free combo style:
 * - Esri satellite raster (real imagery)
 * - OpenMapTiles vector from MapLibre demo (for 3D building extrusion)
 */
const SATELLITE_3D_STYLE = {
  version: 8,
  sources: {
    // Satellite base
    esri_sat: {
      type: "raster",
      tiles: [
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri",
    },

    // Vector tiles (buildings/roads) — free demo tiles
    omt: {
      type: "vector",
      url: "https://demotiles.maplibre.org/tiles/tiles.json",
    },
  },

  layers: [
    // Satellite background
    { id: "satellite", type: "raster", source: "esri_sat" },

    // ---- 3D Buildings (extruded) ----
    {
      id: "buildings-3d",
      type: "fill-extrusion",
      source: "omt",
      "source-layer": "building",
      minzoom: 14,
      filter: [
        ">",
        ["to-number", ["coalesce", ["get", "render_height"], ["get", "height"], 0]],
        0,
      ],
      paint: {
        "fill-extrusion-color": "rgba(120, 130, 140, 0.95)",
        "fill-extrusion-opacity": 0.55,
        "fill-extrusion-height": [
          "to-number",
          ["coalesce", ["get", "render_height"], ["get", "height"], 0],
        ],
        "fill-extrusion-base": [
          "to-number",
          ["coalesce", ["get", "render_min_height"], ["get", "min_height"], 0],
        ],
      },
    },

    // Optional: simple roads to add clarity
    {
      id: "roads",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 10,
      paint: {
        "line-color": "rgba(255,255,255,0.35)",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 16, 2.2],
      },
    },
  ],

  // Light makes extrusions look “3D”
  light: {
    anchor: "viewport",
    color: "white",
    intensity: 0.55,
    position: [1.2, 90, 80],
  },
};

export default function DroneMap() {
  const elRef = useRef(null);

  // ✅ Fixed drone position (later update from Node-RED)
  const droneRef = useRef({
    lon: 46.70191,
    lat: 24.583282,
    alt: 80, // meters
  });

  useEffect(() => {
    if (!elRef.current) return;

    const map = new maplibregl.Map({
      container: elRef.current,
      style: SATELLITE_3D_STYLE,
      center: [droneRef.current.lon, droneRef.current.lat],
      zoom: 17,
      pitch: 80,
      bearing: -20,
      canvasContextAttributes: { antialias: true },
    });

    map.setMaxPitch(85);
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("error", (e) => console.error("MapLibre error:", e?.error || e));

    // Optional: fog (if supported by your MapLibre version)
    try {
      map.setFog({
        range: [0.5, 10],
        color: "rgba(255,255,255,0.18)",
        "high-color": "rgba(200,220,255,0.20)",
        "space-color": "rgba(10,10,20,0.10)",
        "horizon-blend": 0.15,
      });
    } catch {}

    // Optional: sky (if supported)
    map.once("load", () => {
      try {
        map.addLayer({
          id: "sky",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun-intensity": 10,
          },
        });
      } catch {}
    });

    const customLayer = {
      id: "drone-3d",
      type: "custom",
      renderingMode: "3d",

      onAdd(map, gl) {
        this.map = map;
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();
        this.clock = new THREE.Clock();

        // Stronger lighting so drone pops
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.60));

        const key = new THREE.DirectionalLight(0xffffff, 1.35);
        key.position.set(40, -40, 70).normalize();
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0xffffff, 0.55);
        fill.position.set(-25, 25, 40).normalize();
        this.scene.add(fill);

        this.droneGroup = new THREE.Group();
        this.scene.add(this.droneGroup);

        // ---- Make drone eye-catching ----
        // Halo ring
        const haloMat = new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          transparent: true,
          opacity: 0.25,
          depthTest: false,
        });
        this.halo = new THREE.Mesh(new THREE.RingGeometry(0.7, 1.08, 64), haloMat);
        this.halo.rotation.x = -Math.PI / 2;
        this.halo.position.set(0, 0.02, 0);
        this.halo.renderOrder = 999;
        this.droneGroup.add(this.halo);

        // Glow point light
        this.glow = new THREE.PointLight(0x22d3ee, 2.4, 12);
        this.glow.position.set(0, 0.7, 0);
        this.droneGroup.add(this.glow);

        // Fans
        this.spinBlades = [];
        this.propSpin = 24;

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
            color: 0xf8fafc,
            roughness: 0.3,
            metalness: 0.1,
            emissive: new THREE.Color(0x111827),
            emissiveIntensity: 0.10,
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

        // Texture redirect for your GLB (Windows absolute -> /textures/<file>)
        const manager = new THREE.LoadingManager();
        manager.setURLModifier((url) => {
          const file = String(url).split("\\").pop().split("/").pop();
          if (/\.(png|jpg|jpeg)$/i.test(file)) return `/textures/${file}`;
          return url;
        });

        const loader = new GLTFLoader(manager);

        // ---- Tuning knobs ----
        this.sizeMeters = 14; // 🔥 Make drone BIG & visible (try 10..22)
        this.fanXFactor = 0.42;
        this.fanZFactor = 0.42;
        this.fanYFactor = 0.30;
        this.fanLift = 0.02;

        loader.load(
          "/models/drone.glb",
          (gltf) => {
            this.model = gltf.scene;

            this.model.traverse((o) => {
              if (o.isMesh) o.frustumCulled = false;
            });

            // Normalize + recenter model (so fan placement works)
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

            // Outline edges (super visible on satellite)
            const outlineGroup = new THREE.Group();
            const outlineMat = new THREE.LineBasicMaterial({
              color: 0x22d3ee,
              transparent: true,
              opacity: 0.55,
              depthTest: false,
            });

            this.model.traverse((o) => {
              if (!o.isMesh || !o.geometry) return;
              const edges = new THREE.EdgesGeometry(o.geometry, 35);
              const line = new THREE.LineSegments(edges, outlineMat);
              line.renderOrder = 998;
              outlineGroup.add(line);
            });

            this.droneGroup.add(this.model);
            this.droneGroup.add(outlineGroup);

            // Fan positions from bbox corners (your “perfect” method)
            const rx = size.x * this.fanXFactor;
            const rz = size.z * this.fanZFactor;
            const ry = -size.y / 2 + size.y * this.fanYFactor;

            [
              new THREE.Vector3(+rx, ry, +rz),
              new THREE.Vector3(-rx, ry, +rz),
              new THREE.Vector3(+rx, ry, -rz),
              new THREE.Vector3(-rx, ry, -rz),
            ].forEach((p) => {
              const prop = makePropeller();
              prop.position.set(p.x, p.y + this.fanLift, p.z);
              this.droneGroup.add(prop);
            });
          },
          undefined,
          (err) => console.error("❌ GLB load error:", err)
        );

        this.renderer = new THREE.WebGLRenderer({
          canvas: map.getCanvas(),
          context: gl,
          antialias: true,
        });

        // Don’t clear map
        this.renderer.autoClear = false;
        this.renderer.autoClearColor = false;
        this.renderer.autoClearDepth = false;
        this.renderer.autoClearStencil = false;
        this.renderer.setClearAlpha(0);
      },

      render(gl, matrixOrArgs) {
        const mainMatrix = Array.isArray(matrixOrArgs)
          ? matrixOrArgs
          : matrixOrArgs?.defaultProjectionData?.mainMatrix;
        if (!mainMatrix) return;

        const delta = this.clock ? this.clock.getDelta() : 0.016;

        // Spin fans
        if (this.spinBlades?.length) {
          for (const g of this.spinBlades) g.rotation.y += delta * this.propSpin;
        }

        // Hover + halo pulse
        const t = performance.now();
        const hover = Math.sin(t / 350) * 0.6;

        if (this.halo) {
          const pulse = 1 + Math.abs(Math.sin(t / 450)) * 0.18;
          this.halo.scale.set(pulse, pulse, pulse);
          this.halo.material.opacity = 0.16 + Math.abs(Math.sin(t / 450)) * 0.18;
        }

        const { lon, lat, alt } = droneRef.current;
        const mc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], alt + hover);

        const metersToMerc = mc.meterInMercatorCoordinateUnits();
        const scale = metersToMerc * this.sizeMeters;

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

    map.once("load", () => {
      map.addLayer(customLayer);
    });

    return () => map.remove();
  }, []);

  return (
    <div className="relative h-[80vh] w-full overflow-hidden rounded-2xl border border-slate-200">
      <div ref={elRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-4 top-4 rounded-xl bg-black/55 px-3 py-2 text-sm text-white backdrop-blur">
        <div className="font-semibold">3D Satellite + Buildings + Drone</div>
        <div className="text-white/80">
          {droneRef.current.lat.toFixed(6)}, {droneRef.current.lon.toFixed(6)} • Alt {droneRef.current.alt}m
        </div>
        <div className="mt-1 text-xs text-white/70">Halo + Outline enabled</div>
      </div>
    </div>
  );
}