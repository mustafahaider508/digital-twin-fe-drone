"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import DroneDashboard from "@/app/components/DroneDashboard";
import { tenantHeaders, useTenant } from "@/app/providers/TenantProvider";

const API = process.env.NEXT_PUBLIC_API_BASE;
const isUibuilderDashboard = process.env.NEXT_PUBLIC_UIBUILDER_ENTRY === "dashboard";

export default function HomePage() {
  const { tenantId } = useTenant();
  const [twins, setTwins] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (isUibuilderDashboard) return;
    let alive = true;

    fetch(`${API}/twins`, {
      cache: "no-store",
      headers: tenantHeaders(tenantId),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const items = d.items || d.twins || [];
        setTwins(Array.isArray(items) ? items : []);
      })
      .catch(() => setErr("API not reachable. Is the simulator running?"));

    return () => {
      alive = false;
    };
  }, [tenantId]);

  if (isUibuilderDashboard) {
    return <DroneDashboard />;
  }

  return (
    <div>
      <div className="sectionHead">
        <div>
          <div className="kicker">Overview</div>
          <h1 className="h1">Twin Registry</h1>
        </div>
        <span className="badge">
          <i /> Live
        </span>
      </div>

      {err ? <div className="small">{err}</div> : null}

      <div className="grid" style={{ marginTop: 14 }}>
        {twins.length === 0 ? (
          <div className="small">
            No twins yet. Start Simulator + Backend, then refresh.
          </div>
        ) : (
          twins.map((t) => {
            const id = typeof t === "string" ? t : t.deviceId;
            const type = typeof t === "object" && t?.type ? ` · ${t.type}` : "";
            return (
              <Link
                key={`${tenantId}-${id}`}
                href={`/twins/${encodeURIComponent(id)}`}
                className="card"
              >
                <div className="cardTitle">
                  {id}
                  {type}
                </div>
                <div className="cardMeta">Tenant: {tenantId} →</div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
