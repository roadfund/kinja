"use client";

import { useCallback, useEffect, useState } from "react";
import { storageUsageBytes, STORAGE_LIMIT_BYTES, STORAGE_WARNING_RATIO } from "@/repositories/browser-store";
import { getSyncMeta, listQueue, QUEUE_EVENT, refreshOfflinePack, syncNow, type QueueItem } from "./field-sync";

export type FieldSyncState = { items: QueueItem[]; pending: number; failed: number; online: boolean; syncing: boolean; lastSyncedAt?: string; storageNearlyFull: boolean; ready: boolean };

// Live view of the device's sync queue, re-read whenever it changes.
export function useFieldSync(userId: string) {
  const [state, setState] = useState<FieldSyncState>({ items: [], pending: 0, failed: 0, online: true, syncing: false, storageNearlyFull: false, ready: false });

  const read = useCallback(() => {
    const items = listQueue(userId);
    setState((current) => ({ ...current, items, pending: items.filter((item) => item.status === "PENDING").length, failed: items.filter((item) => item.status === "FAILED").length, online: navigator.onLine, lastSyncedAt: getSyncMeta(userId).lastSyncedAt, storageNearlyFull: storageUsageBytes() > STORAGE_LIMIT_BYTES * STORAGE_WARNING_RATIO, ready: true }));
  }, [userId]);

  const sync = useCallback(async () => {
    setState((current) => ({ ...current, syncing: true }));
    try {
      await syncNow(userId);
      await refreshOfflinePack(userId).catch(() => undefined);
    } finally {
      setState((current) => ({ ...current, syncing: false }));
      read();
    }
  }, [read, userId]);

  useEffect(() => {
    const timer = window.setTimeout(read, 0);
    window.addEventListener(QUEUE_EVENT, read);
    window.addEventListener("storage", read);
    window.addEventListener("offline", read);
    return () => { window.clearTimeout(timer); window.removeEventListener(QUEUE_EVENT, read); window.removeEventListener("storage", read); window.removeEventListener("offline", read); };
  }, [read]);

  return { ...state, sync };
}
