import { ArrowLeft, UsersRound } from "lucide-react";
import Link from "next/link";

export function HubTeamShell({ back, title, description, children }: { back: { href: string; label: string }; title: string; description: string; children: React.ReactNode }) {
  return <section className="px-6 py-8 sm:px-10">
    <header><Link className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--kinja-green)]" href={back.href}><ArrowLeft aria-hidden="true" size={16} />{back.label}</Link>
      <div className="mt-10 flex items-start gap-3"><UsersRound className="mt-1 text-[var(--kinja-green)]" size={23} aria-hidden="true" /><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--kinja-green)]">Team</p><h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--kinja-green)]">{title}</h1><p className="mt-4 max-w-2xl leading-7 text-[#5d685e]">{description}</p></div></div>
    </header>
    <section className="mt-10">{children}</section>
  </section>;
}
