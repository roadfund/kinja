import { Check, LoaderCircle } from "lucide-react";

export const inputClass = "mt-2 h-12 w-full rounded-xl border border-[#cbd2c9] bg-white px-4 text-base outline-none placeholder:text-[#9aa69c] focus:border-[var(--kinja-green)] focus:ring-2 focus:ring-[#344e41]/10 disabled:bg-[#f7f9f5] disabled:text-[#718074]";
export const labelClass = "block text-sm font-medium text-[#344e41]";

export function Label({ text, required, hint, children }: { text: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return <label className={labelClass}>{text}{required && <span className="text-[#b42318]"> *</span>}{hint && <span className="font-normal text-[#718074]"> {hint}</span>}{children}</label>;
}

export function FormCard({ title, description, icon, children, onSubmit }: { title: string; description?: string; icon?: React.ReactNode; children: React.ReactNode; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <form className="space-y-5 rounded-2xl border border-[#dce2d9] bg-white p-6 sm:p-8" onSubmit={onSubmit}>
    <div className="flex items-start gap-3">{icon && <span className="mt-0.5 text-[var(--kinja-green)]">{icon}</span>}<div><h2 className="font-semibold text-[var(--kinja-green)]">{title}</h2>{description && <p className="mt-1 text-sm leading-6 text-[#5d685e]">{description}</p>}</div></div>
    {children}
  </form>;
}

export function FormFooter({ pending, error, label, pendingLabel, success, children }: { pending: boolean; error?: string; label: string; pendingLabel: string; success?: string; children?: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-4">
    {error && <p className="text-sm text-[#b42318]" role="alert">{error}</p>}
    {success && !error && <p className="text-sm font-medium text-[#1f6b45]" role="status">{success}</p>}
    {children}
    <button className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--kinja-green)] px-5 font-semibold text-white disabled:opacity-70" aria-busy={pending} disabled={pending} type="submit">{pending ? <LoaderCircle className="animate-spin" size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}{pending ? pendingLabel : label}</button>
  </div>;
}
