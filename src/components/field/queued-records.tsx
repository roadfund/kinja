"use client";

import { CloudUpload } from "lucide-react";
import Link from "next/link";
import { useFieldSync } from "@/field/offline/use-field-sync";
import type { QueueItem } from "@/field/offline/field-sync";

// Records saved on this device that have not reached Kinja yet.
export function QueuedRecords({ userId, kinds, title }: { userId: string; kinds: Array<QueueItem["kind"]>; title: string }) {
  const { items } = useFieldSync(userId);
  const waiting = items.filter((item) => kinds.includes(item.kind));
  if (waiting.length === 0) return null;
  return <section className="mt-6 rounded-2xl border border-[#e4d9aa] bg-[#fff9e8] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-2 font-semibold text-[#6d5a1d]"><CloudUpload size={18} aria-hidden="true" />{waiting.length} {title} waiting to sync</p><Link className="text-sm font-semibold text-[var(--kinja-green)] underline" href="/dashboard/cooperative/sync">Sync status</Link></div>
    <ul className="mt-3 divide-y divide-[#efe5bf] text-sm">{waiting.map((item) => <li className="flex flex-wrap justify-between gap-2 py-2" key={item.opId}><span className="font-medium text-[#344e41]">{item.kind === "UPDATE_FARMER" ? `Edit: ${item.label}` : item.label}</span><span className={item.status === "FAILED" ? "text-[#b42318]" : "text-[#8b6818]"}>{item.status === "FAILED" ? item.lastError : `Saved ${new Date(item.recordedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`}</span></li>)}</ul>
  </section>;
}

export function AwaitingSyncCount({ userId }: { userId: string }) {
  const { pending, failed, ready } = useFieldSync(userId);
  return <>{ready ? pending + failed : "—"}</>;
}
