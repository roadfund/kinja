import type { ZodType } from "zod";

// The only place the browser's localStorage is touched (offline queue and cache).
// Keys are namespaced and versioned; every value is validated on read and write.
const PREFIX = "kinja:v1:";
const SCHEMA_VERSION = 1;
export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
export const STORAGE_WARNING_RATIO = 0.8;

type Envelope = { schemaVersion: number; data: unknown };

export class StorageFullError extends Error {
  constructor() {
    super("This device's storage is full. Connect to the internet to sync, then try again.");
    this.name = "StorageFullError";
  }
}

// Shapes change over time; add a step here whenever a stored shape changes.
const migrations: Record<number, (data: unknown) => unknown> = {};

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readKey<T>(key: string, schema: ZodType<T>, fallback: T): T {
  const store = storage();
  const raw = store?.getItem(PREFIX + key);
  if (!store || !raw) return fallback;
  try {
    let envelope = JSON.parse(raw) as Envelope;
    while (envelope.schemaVersion < SCHEMA_VERSION) envelope = { schemaVersion: envelope.schemaVersion + 1, data: migrations[envelope.schemaVersion]?.(envelope.data) ?? envelope.data };
    return schema.parse(envelope.data);
  } catch (error) {
    // Corrupt or outdated data fails loudly: it is set aside (not lost) and reported.
    store.setItem(`${PREFIX}quarantine:${key}:${Date.now()}`, raw);
    store.removeItem(PREFIX + key);
    window.dispatchEvent(new CustomEvent("kinja-storage-error", { detail: { key, message: error instanceof Error ? error.message : String(error) } }));
    return fallback;
  }
}

export function writeKey<T>(key: string, schema: ZodType<T>, data: T): void {
  const store = storage();
  if (!store) return;
  const envelope: Envelope = { schemaVersion: SCHEMA_VERSION, data: schema.parse(data) };
  try {
    store.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    throw new StorageFullError();
  }
}

export function removeKey(key: string): void {
  storage()?.removeItem(PREFIX + key);
}

// Roughly how much of the ~5MB budget Kinja uses (localStorage stores UTF-16).
export function storageUsageBytes(): number {
  const store = storage();
  if (!store) return 0;
  let bytes = 0;
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key?.startsWith(PREFIX)) bytes += (key.length + (store.getItem(key)?.length ?? 0)) * 2;
  }
  return bytes;
}
