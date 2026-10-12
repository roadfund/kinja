"use client";

import { z } from "zod";
import { createUuidV7 } from "@/domain/id";
import { readKey, StorageFullError, writeKey } from "@/repositories/browser-store";
import type { OfflinePack, SyncResult } from "@/field/sync-service";

// ---- Queue -----------------------------------------------------------------
// Every Kinja Field write is queued on the device first, then sent to the server.

export const QueueItem = z.object({
  opId: z.string(),
  kind: z.enum(["CREATE_FARMER", "UPDATE_FARMER", "RECORD_DELIVERY"]),
  recordId: z.string(),
  recordedAt: z.string(),
  payload: z.unknown(),
  devicePriceMinorPerKg: z.number().int().nonnegative().optional(),
  label: z.string(),
  status: z.enum(["PENDING", "FAILED"]),
  attempts: z.number().int().nonnegative(),
  lastError: z.string().optional(),
});
export type QueueItem = z.infer<typeof QueueItem>;
const Queue = z.array(QueueItem);
const SyncMeta = z.object({ lastSyncedAt: z.string().optional(), lastError: z.string().optional() });

const queueKey = (userId: string) => `field:queue:${userId}`;
const metaKey = (userId: string) => `field:sync-meta:${userId}`;
const packKey = (userId: string) => `field:pack:${userId}`;
export const QUEUE_EVENT = "kinja-queue-change";

function notify() {
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function listQueue(userId: string): QueueItem[] {
  return readKey(queueKey(userId), Queue, []);
}

function saveQueue(userId: string, items: QueueItem[]) {
  writeKey(queueKey(userId), Queue, items);
  notify();
}

export function enqueue(userId: string, item: Omit<QueueItem, "status" | "attempts" | "opId">): QueueItem {
  const queued: QueueItem = { ...item, opId: createUuidV7(), status: "PENDING", attempts: 0 };
  saveQueue(userId, [...listQueue(userId), queued]);
  return queued;
}

export function removeQueued(userId: string, opIds: string[]) {
  saveQueue(userId, listQueue(userId).filter((item) => !opIds.includes(item.opId)));
}

export function retryQueued(userId: string, opId: string) {
  saveQueue(userId, listQueue(userId).map((item) => (item.opId === opId ? { ...item, status: "PENDING", lastError: undefined } : item)));
}

export function getSyncMeta(userId: string) {
  return readKey(metaKey(userId), SyncMeta, {});
}

// ---- Offline cache -----------------------------------------------------------

const CropOption = z.object({ cropId: z.string(), name: z.string(), currency: z.string(), grades: z.array(z.object({ gradeId: z.string(), name: z.string(), priceMinorPerKg: z.number(), currency: z.string() })) });
const Pack = z.object({
  generatedAt: z.string(),
  userId: z.string(),
  cooperative: z.object({ id: z.string(), name: z.string() }),
  currency: z.string(),
  crops: z.array(CropOption),
  farmers: z.array(z.object({ id: z.string(), fullName: z.string(), phone: z.string().optional(), community: z.string(), plots: z.array(z.object({ id: z.string(), description: z.string() })), updatedAt: z.string() })),
});

export function readOfflinePack(userId: string): OfflinePack | null {
  return readKey<OfflinePack | null>(packKey(userId), Pack.nullable(), null);
}

const FIELD_PAGES = ["/dashboard/cooperative", "/dashboard/cooperative/farmers", "/dashboard/cooperative/farmers/new", "/dashboard/cooperative/deliveries", "/dashboard/cooperative/deliveries/new", "/dashboard/cooperative/sync"];

// Refreshes the farmers, crops and prices the device needs offline, and asks the
// service worker to keep the Kinja Field pages available without a connection.
export async function refreshOfflinePack(userId: string): Promise<void> {
  if (!navigator.onLine) return;
  const response = await fetch("/field/offline-pack", { cache: "no-store" });
  if (!response.ok) return;
  const pack = (await response.json()) as OfflinePack;
  if (pack.userId !== userId) return;
  try {
    writeKey(packKey(userId), Pack, pack);
  } catch (error) {
    if (!(error instanceof StorageFullError)) throw error;
  }
  navigator.serviceWorker?.controller?.postMessage({ type: "WARM_PAGES", urls: FIELD_PAGES });
  notify();
}

// ---- Sync ------------------------------------------------------------------

let running: Promise<Map<string, SyncResult>> | null = null;

// Sends pending items in order, in batches. Applied items leave the queue;
// rejected ones stay, marked, so the person can fix or discard them.
export function syncNow(userId: string): Promise<Map<string, SyncResult>> {
  running ??= (async () => {
    // Yield first, so `running` is assigned before the finally block can clear it.
    await Promise.resolve();
    const results = new Map<string, SyncResult>();
    try {
      const pending = listQueue(userId).filter((item) => item.status === "PENDING");
      if (pending.length === 0 || !navigator.onLine) return results;
      for (let start = 0; start < pending.length; start += 50) {
        const batch = pending.slice(start, start + 50);
        let response: Response;
        try {
          response = await fetch("/field/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: batch.map(({ opId, kind, recordId, recordedAt, payload, devicePriceMinorPerKg }) => ({ opId, kind, recordId, recordedAt, payload, devicePriceMinorPerKg })) }) });
        } catch {
          writeKey(metaKey(userId), SyncMeta, { ...getSyncMeta(userId), lastError: "No connection" });
          saveQueue(userId, listQueue(userId).map((item) => (batch.some((sent) => sent.opId === item.opId) ? { ...item, attempts: item.attempts + 1 } : item)));
          break;
        }
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          writeKey(metaKey(userId), SyncMeta, { ...getSyncMeta(userId), lastError: body?.error ?? `Sync failed (${response.status})` });
          break;
        }
        const { results: batchResults } = (await response.json()) as { results: SyncResult[] };
        for (const result of batchResults) results.set(result.opId, result);
        const done = batchResults.filter((result) => result.status !== "REJECTED").map((result) => result.opId);
        const rejected = new Map(batchResults.filter((result) => result.status === "REJECTED").map((result) => [result.opId, result.message ?? "Rejected"]));
        saveQueue(userId, listQueue(userId).filter((item) => !done.includes(item.opId)).map((item) => (rejected.has(item.opId) ? { ...item, status: "FAILED", attempts: item.attempts + 1, lastError: rejected.get(item.opId) } : item)));
        writeKey(metaKey(userId), SyncMeta, { lastSyncedAt: new Date().toISOString() });
      }
      return results;
    } finally {
      running = null;
      notify();
    }
  })();
  return running;
}

export type FieldWriteResult = { status: "synced" | "queued" | "rejected"; message?: string; warnings?: string[] };

// Queues a write and, when online, sends it straight away. A write the server
// rejects is taken back out of the queue so the form can be corrected.
export async function submitFieldWrite(userId: string, item: Omit<QueueItem, "status" | "attempts" | "opId">): Promise<FieldWriteResult> {
  let queued: QueueItem;
  try {
    queued = enqueue(userId, item);
  } catch (error) {
    return { status: "rejected", message: error instanceof Error ? error.message : "Could not save on this device." };
  }
  if (!navigator.onLine) return { status: "queued" };
  const result = (await syncNow(userId)).get(queued.opId);
  if (!result) return { status: "queued" };
  if (result.status === "REJECTED") {
    removeQueued(userId, [queued.opId]);
    return { status: "rejected", message: result.message };
  }
  return { status: "synced", warnings: result.warnings, message: result.status === "SUPERSEDED" ? result.message : undefined };
}
