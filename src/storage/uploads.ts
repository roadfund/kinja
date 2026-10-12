import { createUuidV7 } from "@/domain/id";
import { getObjectStore } from "@/storage/object-store";

// Uploads arrive as data URLs (photos are compressed on the device first). When object
// storage is configured, the file goes to the bucket and the record keeps a short
// /files/<folder>/<id>.<ext> path instead; otherwise the data URL stays in the record.
export type UploadFolder = "users" | "farmers" | "logos" | "certificates";

const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export async function storeUpload(value: string | undefined, folder: UploadFolder): Promise<string | undefined> {
  if (!value || !value.startsWith("data:")) return value;
  const store = getObjectStore();
  if (!store) return value;
  const match = /^data:([^;,]+);base64,([\s\S]*)$/.exec(value);
  if (!match || !types[match[1]]) throw new Error("Upload a JPEG, PNG or WebP image, or a PDF");
  const key = `${folder}/${createUuidV7()}.${types[match[1]]}`;
  await store.put(key, Uint8Array.from(Buffer.from(match[2], "base64")), match[1]);
  return `/files/${key}`;
}
