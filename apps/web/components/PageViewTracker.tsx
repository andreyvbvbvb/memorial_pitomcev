"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { API_BASE } from "../lib/config";

const shouldTrackPath = (pathname: string | null) => {
  if (!pathname || pathname.startsWith("/admin")) {
    return false;
  }
  return true;
};

export default function PageViewTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldTrackPath(pathname) || lastTrackedPath.current === pathname) {
      return;
    }
    lastTrackedPath.current = pathname;
    void fetch(`${API_BASE}/analytics/page-view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {
      // Page analytics must never block navigation or surface errors to users.
    });
  }, [pathname]);

  return null;
}
