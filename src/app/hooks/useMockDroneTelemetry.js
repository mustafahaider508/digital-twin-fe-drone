"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const start = {
  id: "drone_1",
  name: "Drone1",
  lat: 24.583282,
  lon: 46.70191,
  alt: 120,
  speed: 70,
  battery: 80,
  dist_gcs: 280,
  flight_time_left: 540,
  yaw: 20,
  pitch: 8,
  roll: -4,
  ts: Date.now(),
};

export function useMockDroneTelemetry() {
  const [telemetry, setTelemetry] = useState(start);
  const [history, setHistory] = useState([start]);
  const [events, setEvents] = useState([
    { ts: start.ts, msg: "Drone connected (mock data)" },
  ]);

  const t = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      t.current += 1;

      // simple flight circle
      const r = 0.0012;
      const lat = start.lat + r * Math.sin(t.current / 18);
      const lon = start.lon + r * Math.cos(t.current / 18);

      // simulate values
      const yaw = (start.yaw + t.current * 6) % 360;
      const pitch = 10 * Math.sin(t.current / 10);
      const roll = 8 * Math.cos(t.current / 12);

      const speed = 55 + 20 * Math.abs(Math.sin(t.current / 14));
      const alt = 110 + 25 * Math.abs(Math.cos(t.current / 16));

      // battery slowly decreases
      const battery = Math.max(0, start.battery - t.current * 0.03);

      const next = {
        ...start,
        lat,
        lon,
        yaw,
        pitch,
        roll,
        speed: Number(speed.toFixed(1)),
        alt: Number(alt.toFixed(1)),
        battery: Number(battery.toFixed(1)),
        ts: Date.now(),
      };

      setTelemetry(next);

      setHistory((prev) => {
        const updated = [...prev, next];
        return updated.length > 120 ? updated.slice(updated.length - 120) : updated; // keep last 120 points
      });

      // events
      if (battery < 25 && battery > 24.7) {
        setEvents((p) => [{ ts: next.ts, msg: "⚠️ Battery low (<25%)" }, ...p].slice(0, 30));
      }
      if (Math.round(yaw) % 90 === 0) {
        setEvents((p) => [{ ts: next.ts, msg: `Heading crossed ${Math.round(yaw)}°` }, ...p].slice(0, 30));
      }
    }, 350);

    return () => clearInterval(timer);
  }, []);

  return useMemo(() => ({ telemetry, history, events }), [telemetry, history, events]);
}