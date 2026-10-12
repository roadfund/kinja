"use client";

import { Check, ChevronLeft, Plus } from "lucide-react";
import Link from "next/link";

// Shown after a record is saved: start another one, or go back to the list.
export function SuccessDialog({ title, description, againLabel, onAgain, backHref }: { title: string; description: string; againLabel: string; onAgain: () => void; backHref: string }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-labelledby="success-dialog-title">
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e7f6ef] text-[#08a875]"><Check size={24} aria-hidden="true" /></span>
      <h2 className="mt-4 text-lg font-semibold text-[var(--kinja-green)]" id="success-dialog-title">{title}</h2>
      <p className="mt-2 text-sm text-[#5d685e]">{description}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--kinja-green)] font-semibold text-white" onClick={onAgain} type="button" autoFocus><Plus size={17} aria-hidden="true" />{againLabel}</button>
        <Link className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#cbd2c9] font-semibold text-[var(--kinja-green)]" href={backHref}><ChevronLeft size={17} aria-hidden="true" />Back</Link>
      </div>
    </div>
  </div>;
}
