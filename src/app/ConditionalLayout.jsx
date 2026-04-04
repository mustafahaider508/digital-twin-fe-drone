"use client";

import { usePathname } from "next/navigation";
import { PRESETS, useTenant } from "./providers/TenantProvider";

const isUibuilderDashboard = process.env.NEXT_PUBLIC_UIBUILDER_ENTRY === "dashboard";

export default function ConditionalLayout({ children }) {
  const pathname = usePathname() ?? "";
  const isDashboard = pathname.startsWith("/dashboard");
  const isRootDashboard = isUibuilderDashboard && (pathname === "/" || pathname === "");
  const { tenantId, setTenantId } = useTenant();
  const tenantOpts = [...new Set([...PRESETS, tenantId])];

  if (isDashboard || isRootDashboard) {
    return <>{children}</>;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="dot" /> DIGITAL TWIN DASHBOARD
        </div>
        <div className="sub" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span>Realtime + History</span>
          <label className="small" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Tenant
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              style={{ fontSize: 12, padding: "2px 6px" }}
            >
              {tenantOpts.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">
        <span>Express API:</span>{" "}
        <code>{process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000"}</code>
      </footer>
    </div>
  );
}
