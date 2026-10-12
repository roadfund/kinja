import Link from "next/link";
import Image from "next/image";
import { Leaf } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function AuthFrame({ children, eyebrow, title, description }: { children: React.ReactNode; eyebrow: string; title: string; description: string }) {
  return <main className="grid min-h-screen bg-[var(--kinja-cream)] lg:grid-cols-2">
    <section className="relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between">
      <Image src="/hero.JPG" alt="A farmer working in an agricultural field" fill priority className="object-cover object-center" sizes="50vw" />
      <div className="absolute inset-0 bg-[#1e3027]/60" />
      <div className="relative flex h-full flex-col p-12">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Leaf aria-hidden="true" size={22} strokeWidth={2.5} />kinja<span className="text-[var(--kinja-yellow)]">.</span></Link>
        <div className="my-auto"><p className="mb-5 text-sm uppercase tracking-[0.22em] text-[#f1f4e9]"></p><p className="max-w-lg text-4xl font-semibold leading-[1.08] tracking-tight">The Operating System for Africa&apos;s Agricultural Value Chains<span className="text-[var(--kinja-yellow)]">.</span></p></div>
      </div>
    </section>
    <section className="flex items-center px-6 py-12 sm:px-16"><div className="mx-auto w-full max-w-md">
      <div className="mb-10 lg:hidden"><Link href="/" className="flex items-center gap-2 text-2xl font-bold text-[var(--kinja-green)]"><Leaf aria-hidden="true" size={22} strokeWidth={2.5} />kinja<span className="text-[var(--kinja-yellow)]">.</span></Link></div>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--kinja-green)]">{eyebrow}</p><h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--kinja-green)]">{title}</h1><p className="mt-3 leading-7 text-[#5d685e]">{description}</p><div className="mt-8">{children}</div>
    </div></section>
  </main>;
}

export function Notice({ tone = "error", children }: { tone?: "error" | "success"; children: React.ReactNode }) {
  return <p className={`mb-5 rounded-xl border px-4 py-3 text-sm ${tone === "error" ? "border-[#f3c7c2] bg-[#fdf1ef] text-[#9b2c1f]" : "border-[#cce8d5] bg-[#f1fbf3] text-[#1f6b45]"}`} role={tone === "error" ? "alert" : "status"}>{children}</p>;
}

export function Field({ label, name, type = "text", required = true, icon: Icon, placeholder }: { label: string; name: string; type?: string; required?: boolean; icon?: LucideIcon; placeholder?: string }) {
  return <label className="block text-sm font-medium text-[#344e41]">{label}<span className="relative mt-2 block">{Icon && <Icon aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#718074]" size={18} />}<input className={`h-12 w-full rounded-xl border border-[#cbd2c9] bg-white px-4 outline-none transition focus:border-[var(--kinja-green)] focus:ring-2 focus:ring-[#344e41]/10 ${Icon ? "pl-11" : ""}`} name={name} type={type} placeholder={placeholder} required={required} /></span></label>;
}