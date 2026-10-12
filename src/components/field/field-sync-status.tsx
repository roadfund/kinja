"use client";

import { AlertTriangle, CheckCircle2, CloudOff, LoaderCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useFieldSync } from "@/field/offline/use-field-sync";

const AUTO_SYNC_MS = 30_000;

// Shown in the sidebar for cooperative members. Also keeps the queue draining:
// on load, when the connection returns, and every 30 seconds while open.
export function FieldSyncStatus({ userId }: { userId: string }) {
  const { pending, failed, online, syncing, storageNearlyFull, ready, sync } = useFieldSync(userId);

  useEffect(() => {
    const run = () => { if (navigator.onLine) void sync(); };
    const first = window.setTimeout(run, 0);
    const interval = window.setInterval(run, AUTO_SYNC_MS);
    window.addEventListener("online", run);
    return () => { window.clearTimeout(first); window.clearInterval(interval); window.removeEventListener("online", run); };
  }, [sync]);

  if (!ready) return null;
  const tone = failed ? "border-[#f3c7c2] bg-[#fdf1ef] text-[#9b2c1f]" : !online || pending ? "border-[#e4d9aa] bg-[#fff9e8] text-[#6d5a1d]" : "border-[#cce8d5] bg-[#f1fbf3] text-[#1f6b45]";
  const icon = syncing ? <LoaderCircle className="animate-spin" size={15} aria-hidden="true" /> : failed ? <AlertTriangle size={15} aria-hidden="true" /> : !online ? <CloudOff size={15} aria-hidden="true" /> : pending ? <RefreshCw size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />;
  const text = failed ? `${failed} ${failed === 1 ? "record needs" : "records need"} attention` : !online ? (pending ? `Offline · ${pending} waiting to sync` : "Offline · work is saved on this device") : syncing ? "Syncing…" : pending ? `${pending} ${pending === 1 ? "record" : "records"} waiting to sync` : "All records synced";

  return <div className="px-4 pb-1 lg:px-3" aria-live="polite">
    <Link className={`mt-2 flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${tone}`} href="/dashboard/cooperative/sync">{icon}<span>{text}</span></Link>
    {storageNearlyFull && <p className="mt-1 px-1 text-xs text-[#9b2c1f]">Device storage is nearly full. Connect to sync soon.</p>}
  </div>;
}
