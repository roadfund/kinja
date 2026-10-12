export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Shrinks a photo in the browser to a small square-ish JPEG data URL, so it can
// be stored with the record and loads quickly on slow connections.
export async function resizePhoto(file: File, maxSize = 320, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

// Seeded by record id rather than name, so no personal data is sent to DiceBear.
export function avatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/toon-head/svg?seed=${encodeURIComponent(seed)}`;
}

export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;

// Certificates: PDFs are kept as they are; photos are shrunk but stay readable.
export async function readDocument(file: File): Promise<string> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_DOCUMENT_BYTES) throw new Error("The PDF must be smaller than 2MB.");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read this file."));
      reader.readAsDataURL(file);
    });
  }
  if (!PHOTO_TYPES.includes(file.type)) throw new Error("Upload a PDF, JPG, PNG or WebP file.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("The image must be smaller than 5MB.");
  return resizePhoto(file, 1600, 0.85);
}
