import { z } from "zod";

// Uploaded files are kept either in object storage, referenced by a /files/<folder>/<id>.<ext>
// path, or (local development, no bucket configured) inline as a data URL.
export const STORED_FILE = /^\/files\/(users|farmers|logos|certificates)\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;
export const storedImage = z.union([z.string().regex(STORED_FILE), z.string().startsWith("data:image/").max(300_000)]);
