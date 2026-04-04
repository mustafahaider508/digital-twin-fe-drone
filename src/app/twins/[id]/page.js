"use client";

import React, { useEffect, useMemo, useRef, useState, use } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { tenantHeaders, useTenant } from "@/app/providers/TenantProvider";

const API = process.env.NEXT_PUBLIC_API_BASE;

function fmtTs(ts) {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "";
  }
}

export default function TwinDetailPage({ params }) {
  const { tenantId } = useTenant();
  const { id } = use(params);
  const twinId = decodeURIComponent(id);

  const [latest, setLatest] = useState({});
  const [metric, setMetric] = useState("temperature");
  const [points, setPoints] = useState([]);
  const [status, setStatus] = useState("connecting...");

  const esRef = useRef(null);

  const metricOptions = useMemo(() => {
    const keys = Object.keys(latest);
    return keys.length ? keys : ["temperature", "humidity", "vibration", "cpu", "latency", "packetLoss"];
  }, [latest]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      setStatus("loading...");
      try {
        const a = await fetch(`${API}/twins/${encodeURIComponent(twinId)}/latest`, {
          cache: "no-store",
          headers: tenantHeaders(tenantId),
        });
        const latestRes = await a.json();
        if (!alive) return;

        const l = latestRes.latest || {};
        setLatest(l);

        const firstMetric = Object.keys(l)[0] || metric;
        setMetric((m) => (l[m] ? m : firstMetric));

        setStatus("live");
      } catch {
        if (!alive) return;
        setStatus("API not reachable");
      }
    }

    boot();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twinId, tenantId]);

  useEffect(() => {
    let alive = true;

    async function loadHistory() {
      try {
        const url = `${API}/twins/${encodeURIComponent(twinId)}/history?metric=${encodeURIComponent(metric)}&limit=200`;
        const r = await fetch(url, {
          cache: "no-store",
          headers: tenantHeaders(tenantId),
        });
        const d = await r.json();
        if (!alive) return;

        const p = (d.points || []).map((x) => ({ ts: x.ts, t: fmtTs(x.ts), value: x.value }));
        setPoints(p);
      } catch {}
    }

    loadHistory();
    return () => { alive = false; };
  }, [twinId, metric, tenantId]);

  useEffect(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setStatus("connecting...");

    const es = new EventSource(`${API}/twins/${encodeURIComponent(twinId)}/stream`);
    esRef.current = es;

    es.onopen = () => setStatus("live");
    es.onerror = () => setStatus("stream error");

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (!msg?.metric) return;

        setLatest((prev) => ({ ...prev, [msg.metric]: msg }));

        if (msg.metric === metric) {
          setPoints((prev) => {
            const next = [...prev, { ts: msg.ts, t: fmtTs(msg.ts), value: msg.value }];
            return next.length > 200 ? next.slice(next.length - 200) : next;
          });
        }
      } catch {}
    };

    return () => es.close();
  }, [twinId, metric]);

  const kpiList = useMemo(() => {
    const order = ["temperature", "humidity", "cpu", "latency"];
    const picked = [];
    for (const key of order) if (latest[key]) picked.push(latest[key]);
    for (const k of Object.keys(latest)) {
      if (picked.length >= 4) break;
      if (!picked.find((x) => x.metric === k)) picked.push(latest[k]);
    }
    return picked.slice(0, 4);
  }, [latest]);

  return (
    <div>
      <div className="sectionHead">
        <div>
          <div className="kicker">
            <Link href="/">← Back</Link> &nbsp; / &nbsp; Twin
          </div>
          <h1 className="h1">{twinId}</h1>
        </div>
        <span className="badge">
          <i /> {status}
        </span>
      </div>

      <div className="kpis">
        {kpiList.map((k) => (
          <div className="kpi" key={k.metric}>
            <div className="kpiLabel">{k.metric}</div>
            <div className="kpiValue">
              {k.value} <span style={{ fontSize: 14, color: "var(--muted)" }}>{k.unit}</span>
            </div>
            <div className="kpiTs">Updated: {fmtTs(k.ts)}</div>
          </div>
        ))}
      </div>

      <div className="row">
        <div className="panel">
          <div className="sectionHead" style={{ marginBottom: 10 }}>
            <div>
              <div className="kicker">Telemetry</div>
              <div style={{ fontWeight: 900, letterSpacing: "0.02em" }}>
                {metric} — last 200 points
              </div>
            </div>
          </div>

          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <XAxis dataKey="t" tick={{ fill: "#bdbdbd", fontSize: 12 }} />
                <YAxis tick={{ fill: "#bdbdbd", fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="small">Tip: chart updates live via SSE stream.</div>
        </div>

        <div className="side">
          <div className="kicker">Controls</div>
          <div style={{ fontWeight: 900, marginTop: 6 }}>Metric</div>
          <select className="select" value={metric} onChange={(e) => setMetric(e.target.value)}>
            {metricOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <div className="small">Next: time ranges + alerts + network view.</div>
        </div>
      </div>
    </div>
  );
}
