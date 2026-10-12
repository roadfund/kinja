"use client";

import { CloudOff, LoaderCircle, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { bodyCell, headCell, tableClass, tableFrame } from "@/components/kinja/table-styles";
import { Button } from "@/components/ui/button";
import { removeQueued, retryQueued } from "@/field/offline/field-sync";
import { useFieldSync } from "@/field/offline/use-field-sync";

const kindLabels = { CREATE_FARMER: "New farmer", UPDATE_FARMER: "Farmer edit", RECORD_DELIVERY: "Delivery" } as const;

export function SyncQueue({ userId }: { userId: string }) {
  const { items, pending, failed, online, syncing, lastSyncedAt, sync } = useFieldSync(userId);
  return <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl bg-white p-5"><p className="text-sm text-[#718074]">Connection</p><p className={`mt-2 flex items-center gap-2 text-2xl font-semibold ${online ? "text-[var(--kinja-green)]" : "text-[#8b6818]"}`}>{!online && <CloudOff size={20} aria-hidden="true" />}{online ? "Online" : "Offline"}</p><p className="mt-1 text-sm text-[#5d685e]">{online ? "Records sync automatically" : "Work is saved on this device"}</p></div>
      <div className="rounded-2xl bg-white p-5"><p className="text-sm text-[#718074]">Waiting to sync</p><p className="mt-2 text-3xl font-semibold text-[var(--kinja-green)]">{pending}</p><p className="mt-1 text-sm text-[#5d685e]">On this device</p></div>
      <div className={`rounded-2xl bg-white p-5 ${failed ? "ring-1 ring-[#f3c7c2]" : ""}`}><p className="text-sm text-[#718074]">Needs attention</p><p className={`mt-2 text-3xl font-semibold ${failed ? "text-[#b42318]" : "text-[var(--kinja-green)]"}`}>{failed}</p><p className="mt-1 text-sm text-[#5d685e]">Rejected by the server</p></div>
      <div className="rounded-2xl bg-white p-5"><p className="text-sm text-[#718074]">Last synced</p><p className="mt-2 text-xl font-semibold text-[var(--kinja-green)]">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Not yet"}</p><Button className="mt-2" disabled={!online || syncing} onClick={() => void sync()} size="sm" type="button" variant="outline">{syncing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}Sync now</Button></div>
    </div>
    {items.length === 0 ? <p className="rounded-2xl border border-dashed border-[#cbd2c9] bg-white/60 p-6 text-center text-[#5d685e]">Everything recorded on this device has been synced.</p> :
      <div className={tableFrame}><table className={tableClass}>
        <thead><tr>{["Recorded", "Type", "Record", "Status", "Tries", "Error", "", ""].map((header, index) => <th className={headCell} key={index} scope="col">{header}</th>)}</tr></thead>
        <tbody>{items.map((item) => <tr className="group" key={item.opId}>
          <td className={bodyCell}>{new Date(item.recordedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
          <td className={bodyCell}>{kindLabels[item.kind]}</td>
          <td className={`${bodyCell} font-medium text-[#344e41]`}>{item.label}</td>
          <td className={bodyCell}>{item.status === "FAILED" ? <span className="font-semibold text-[#b42318]">Failed</span> : <span className="text-[#8b6818]">Waiting</span>}</td>
          <td className={`${bodyCell} text-right tabular-nums`}>{item.attempts}</td>
          <td className={bodyCell}>{item.status === "FAILED" ? item.lastError : "—"}</td>
          <td className={bodyCell}>{item.status === "FAILED" && <Button onClick={() => { retryQueued(userId, item.opId); void sync(); }} size="sm" type="button" variant="outline"><RotateCcw aria-hidden="true" />Retry</Button>}</td>
          <td className={bodyCell}>{item.status === "FAILED" && <Button onClick={() => removeQueued(userId, [item.opId])} size="sm" type="button" variant="destructive"><Trash2 aria-hidden="true" />Discard</Button>}</td>
        </tr>)}</tbody>
      </table></div>}
  </div>;
}
