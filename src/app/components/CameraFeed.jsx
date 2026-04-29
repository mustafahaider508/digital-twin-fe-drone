"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";

export default function CameraFeed({ wsUrl, enabled = true, onConnectionChange }) {
  const [src, setSrc] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const lastUrlRef = useRef(null);
  const onConnRef = useRef(onConnectionChange);

  useEffect(() => {
    onConnRef.current = onConnectionChange;
  }, [onConnectionChange]);

  useEffect(() => {
    if (!enabled || !wsUrl) return;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      if (typeof onConnRef.current === "function") onConnRef.current(true);
      console.log("[CameraFeed] WS connected");
    };
    ws.onerror = (e) => console.warn("[CameraFeed] WS error", e);
    ws.onclose = () => {
      setWsConnected(false);
      if (typeof onConnRef.current === "function") onConnRef.current(false);
      console.log("[CameraFeed] WS closed");
    };

    ws.onmessage = (evt) => {
      try {
        const buf = evt.data;
        const blob = new Blob([buf], { type: "image/jpeg" });
        const url = URL.createObjectURL(blob);

        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
        lastUrlRef.current = url;
        setSrc(url);
      } catch (e) {
        console.warn("[CameraFeed] frame decode failed", e);
      }
    };

    return () => {
      try { ws.close(); } catch {}
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = null;
    };
  }, [wsUrl, enabled]);

  const connected = Boolean(enabled && wsUrl && wsConnected);

  return (
    <div style={S.wrap}>
      {src ? (
        <div style={S.imgWrap}>
          <Image
            src={src}
            alt="Drone camera"
            fill
            sizes="100vw"
            style={S.img}
            unoptimized
            priority={false}
          />
        </div>
      ) : (
        <div style={S.placeholder}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          <div style={S.placeholderText}>Awaiting video stream</div>
          <div style={S.placeholderSub}>
            {connected ? "CONNECTED" : "DISCONNECTED"} · {wsUrl}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  wrap: {
    height: "100%",
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(10, 14, 24, 0.6)",
    display: "grid",
    placeItems: "center",
  },
  imgWrap: { position: "relative", width: "100%", height: "100%" },
  img: { objectFit: "cover" },
  placeholder: {
    textAlign: "center",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  placeholderText: {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
  },
  placeholderSub: {
    fontSize: 9,
    color: "#475569",
    fontFamily: "monospace",
  },
};
