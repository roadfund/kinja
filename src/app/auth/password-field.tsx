"use client";

import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState } from "react";

export function PasswordField({ label, name, placeholder, minLength }: { label: string; name: string; placeholder?: string; minLength?: number }) {
  const [visible, setVisible] = useState(false);

  return <label className="block text-sm font-medium text-[#344e41]">{label}<span className="relative mt-2 block"><LockKeyhole aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718074]" size={18} /><input className="h-12 w-full rounded-xl border border-[#cbd2c9] bg-white px-4 pl-11 pr-12 outline-none transition focus:border-[var(--kinja-green)] focus:ring-2 focus:ring-[#344e41]/10" name={name} type={visible ? "text" : "password"} placeholder={placeholder} minLength={minLength} required /><button aria-label={visible ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#718074] transition hover:bg-[#eef1eb] hover:text-[var(--kinja-green)]" onClick={() => setVisible((current) => !current)} type="button">{visible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}</button></span></label>;
}