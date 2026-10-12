"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

type Props = { year?: string; month?: string; distributorId?: string; currency: string; currencies: string[]; periods: string[]; distributors: Array<{ id: string; name: string }> };

const label = "grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#718074]";
const select = "h-10 rounded-lg border border-[#cbd2c9] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#344e41] outline-none focus:border-[var(--kinja-green)] focus:ring-2 focus:ring-[#344e41]/10 disabled:cursor-not-allowed disabled:bg-[#f7f9f5]";
const monthName = (month: string) => new Date(`2000-${month}-01T00:00:00.000Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });

// Year, month and (for the hub) distributor filters. They apply as soon as a value is picked,
// in place: the page updates without reloading and keeps other filters such as the status tab.
// Months list only the ones with orders in the chosen year.
export function OrderFilters({ year, month, distributorId, currency, currencies, periods, distributors }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const years = [...new Set(periods.map((period) => period.slice(0, 4)))].sort().reverse();
  const months = year ? periods.filter((period) => period.startsWith(year)).map((period) => period.slice(5, 7)).sort() : [];

  function apply(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  function chooseYear(value: string) {
    // Keep the month only if the new year has orders in it.
    const keep = value && month && periods.includes(`${value}-${month}`) ? month : undefined;
    apply({ year: value || undefined, month: keep });
  }

  return <div className={cn("flex flex-wrap items-end gap-2 transition-opacity", pending && "opacity-60")}>
    <label className={label}>Year<select className={cn(select, "w-32")} onChange={(event) => chooseYear(event.target.value)} value={year ?? ""}><option value="">All years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
    <label className={label}>Month<select className={cn(select, "w-40")} disabled={!year} onChange={(event) => apply({ month: event.target.value || undefined })} title={year ? undefined : "Choose a year first"} value={month ?? ""}><option value="">All months</option>{months.map((item) => <option key={item} value={item}>{monthName(item)}</option>)}</select></label>
    {distributors.length > 1 && <label className={label}>Distributor<select className={cn(select, "w-52")} onChange={(event) => apply({ distributor: event.target.value || undefined })} value={distributorId ?? ""}><option value="">All distributors</option>{distributors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    {currencies.length > 1 && <div className={label}>Currency<div className="flex h-10 rounded-lg border border-[#cbd2c9] bg-white p-0.5" role="group" aria-label="Chart currency">{currencies.map((code) => <button aria-pressed={code === currency} className={cn("rounded-md px-3 text-sm font-semibold normal-case tracking-normal transition", code === currency ? "bg-[var(--kinja-green)] text-white" : "text-[#5d685e] hover:bg-[#f0f4ed]")} key={code} onClick={() => apply({ currency: code })} type="button">{code}</button>)}</div></div>}
    {pending && <LoaderCircle className="mb-2.5 animate-spin text-[#718074]" size={18} aria-label="Updating" />}
  </div>;
}
