"use client";

import { Camera, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { MAX_PHOTO_BYTES, PHOTO_TYPES, resizePhoto } from "@/lib/image";

// File picker that resizes the photo in the browser and submits it as a data
// URL in a hidden input named `name`.
export function PhotoField({ label, name, required = false, hint, value, onChange }: { label: string; name: string; required?: boolean; hint?: string; value?: string; onChange?: (photoUrl: string) => void }) {
  const [localValue, setLocalValue] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const photoUrl = value ?? localValue;

  async function select(input: HTMLInputElement) {
    const file = input.files?.[0];
    setError("");
    if (!file) return;
    const problem = !PHOTO_TYPES.includes(file.type) ? "Use a JPG, PNG or WebP photo." : file.size > MAX_PHOTO_BYTES ? "Photo must be smaller than 5MB." : "";
    if (problem) {
      input.value = "";
      setError(problem);
      return;
    }
    setProcessing(true);
    try {
      const resized = await resizePhoto(file);
      setLocalValue(resized);
      onChange?.(resized);
    } catch {
      input.value = "";
      setError("Could not read this photo. Try another one.");
    } finally {
      setProcessing(false);
    }
  }

  return <div><label className="flex items-center gap-4 rounded-xl border border-dashed border-[#cbd2c9] bg-white p-4 text-sm text-[#5d685e]">
    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e7eee4] text-[var(--kinja-green)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
      {processing ? <LoaderCircle className="animate-spin" size={20} aria-hidden="true" /> : photoUrl ? <img alt="" className="h-full w-full object-cover" src={photoUrl} /> : <Camera size={22} aria-hidden="true" />}
    </span>
    <span className="min-w-0 flex-1"><span className="block font-semibold text-[var(--kinja-green)]">{label}{required && <span className="text-[#b42318]"> *</span>} <span className="font-normal text-[#718074]">{hint ?? "(JPG, PNG or WebP, max 5MB)"}</span></span><input className="mt-2 block w-full text-sm" accept={PHOTO_TYPES.join(",")} required={required && !photoUrl} type="file" onChange={(event) => select(event.currentTarget)} /></span>
  </label>
  <input name={name} type="hidden" value={photoUrl} />
  {error && <p className="mt-2 text-sm text-[#b42318]" role="alert">{error}</p>}</div>;
}
