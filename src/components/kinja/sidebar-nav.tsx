"use client";

import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = { label: string; href: string; icon: React.ReactNode; locked?: boolean };

const linkClass = (active: boolean) => cn("flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-sm", active ? "bg-[#e7eee4] font-semibold text-[var(--kinja-green)]" : "text-[#5d685e] transition hover:bg-[#f0f4ed] hover:text-[var(--kinja-green)]");

// The item for the current page: the longest matching path wins. An item whose link has a
// query (e.g. ?module=pay) only matches when the address has the same values, and then beats
// the plain link for the same page.
export function activeHref(items: Array<Pick<NavItem, "href">>, pathname: string, params: URLSearchParams): string | undefined {
  let best: { href: string; score: number } | undefined;
  for (const { href } of items) {
    const [path, query] = href.split("?");
    if (pathname !== path && !pathname.startsWith(`${path}/`)) continue;
    const wanted = new URLSearchParams(query ?? "");
    if ([...wanted].some(([key, value]) => params.get(key) !== value)) continue;
    const score = path.length * 10 + [...wanted].length;
    if (!best || score > best.score) best = { href, score };
  }
  return best?.href;
}

// The sidebar menu. It lives in the shared layout, so it stays put while pages change.
export function SidebarNav({ items, label }: { items: NavItem[]; label: string }) {
  const active = activeHref(items, usePathname(), new URLSearchParams(useSearchParams().toString()));
  return <nav className="flex gap-1 overflow-x-auto px-4 py-3 lg:mt-4 lg:block lg:flex-1 lg:space-y-1 lg:px-3" aria-label={label}>
    {items.map((item) => item.locked
      ? <span aria-disabled="true" className="flex min-w-max items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#a4aea5]" key={item.href} title="Available after hub verification">{item.icon}<span>{item.label}</span><LockKeyhole className="ml-auto" size={14} aria-hidden="true" /></span>
      : <Link aria-current={item.href === active ? "page" : undefined} className={linkClass(item.href === active)} href={item.href} key={item.href}>{item.icon}<span>{item.label}</span></Link>)}
  </nav>;
}

export function ProfileLink({ icon }: { icon: React.ReactNode }) {
  const active = usePathname() === "/dashboard/profile";
  return <Link aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 text-sm", active ? "font-semibold text-[var(--kinja-green)]" : "text-[#5d685e]")} href="/dashboard/profile">{icon}Profile</Link>;
}
