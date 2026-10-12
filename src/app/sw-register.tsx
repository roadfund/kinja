"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const PAGE_CACHE = "kinja-v2-pages";
const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "1";

export function ServiceWorkerRegister() {
  const pathname = usePathname();

  useEffect(() => {
    if (enabled && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
  }, []);

  // Pages saved for offline use belong to whoever was signed in. Forget them on
  // the sign-in and sign-out screens so the next person on a shared phone cannot see them.
  useEffect(() => {
    if (!pathname.startsWith("/auth/")) return;
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_PAGES" });
    if ("caches" in window) void caches.delete(PAGE_CACHE);
  }, [pathname]);

  return null;
}
