"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "dt-tenant-id";

const DEFAULT =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_DEFAULT_TENANT) || "default";

const TenantContext = createContext({
  tenantId: DEFAULT,
  setTenantId: () => {},
});

/** Optional comma-separated list in env */
const PRESETS = (
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TENANT_PRESETS) ||
  "default,acme,demo"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function readStoredTenant() {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && /^[\w.-]+$/.test(v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT;
}

export function TenantProvider({ children }) {
  const [tenantId, setTenantIdState] = useState(DEFAULT);

  useEffect(() => {
    const v = readStoredTenant();
    if (v !== DEFAULT) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate tenant from localStorage after SSR
      setTenantIdState(v);
    }
  }, []);

  const setTenantId = useCallback((next) => {
    const s = String(next || "").trim().slice(0, 64);
    if (!s || !/^[\w.-]+$/.test(s)) return;
    setTenantIdState(s);
    try {
      localStorage.setItem(STORAGE_KEY, s);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ tenantId, setTenantId }),
    [tenantId, setTenantId]
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

export function tenantHeaders(tenantId) {
  return { "X-Tenant-Id": tenantId || DEFAULT };
}

export { PRESETS };
