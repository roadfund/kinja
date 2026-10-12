"use client";

import { ChevronLeft, ChevronRight, LoaderCircle, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

const PAGE_SIZES = [10, 25, 50, 100];

type Props = { frameClass: string; tableClass: string; head: React.ReactNode; rows: React.ReactNode[]; tableKey: string; page: number; pages: number; size: number; initialSize: number; query: string; total: number; matches: number };

// The table's pages and search. The server sends only the rows on screen; moving page,
// searching or changing rows per page updates the address and the server renders that
// slice, in place, without reloading. The current rows stay visible (dimmed) meanwhile.
export function TablePager({ frameClass, tableClass, head, rows, tableKey, page, pages, size, initialSize, query, total, matches }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [typed, setTyped] = useState(query);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function go(changes: Record<string, string | number | undefined>, replace = false) {
    const next = new URLSearchParams(params.toString());
    for (const [name, value] of Object.entries(changes)) {
      const param = `${tableKey}.${name}`;
      if (value === undefined || value === "" || (name === "page" && value === 1) || (name === "size" && value === initialSize)) next.delete(param); else next.set(param, String(value));
    }
    const target = next.toString() ? `${pathname}?${next}` : pathname;
    startTransition(() => (replace ? router.replace(target, { scroll: false }) : router.push(target, { scroll: false })));
  }

  // Search as you type, after a short pause, always from the first page.
  function search(value: string) {
    setTyped(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => go({ q: value.trim(), page: 1 }, true), 300);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const first = matches ? (page - 1) * size + 1 : 0;
  return <div className="mt-5">
    {total > PAGE_SIZES[0] && <div className="relative mb-3 max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69c]" size={16} aria-hidden="true" />
      <input aria-label="Search this table" className="h-11 w-full rounded-xl border border-[#cbd2c9] bg-white pl-9 pr-9 text-sm outline-none placeholder:text-[#9aa69c] focus:border-[var(--kinja-green)] focus:ring-2 focus:ring-[#344e41]/10" onChange={(event) => search(event.target.value)} placeholder="Search" type="search" value={typed} />
      {pending ? <LoaderCircle className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#718074]" size={15} aria-label="Searching" /> : typed && <button aria-label="Clear search" className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#718074] hover:bg-[#eef1eb]" onClick={() => search("")} type="button"><X size={14} aria-hidden="true" /></button>}
    </div>}
    <div className={cn(frameClass, "mt-0 transition-opacity", pending && "opacity-60")}><table className={tableClass}><thead>{head}</thead><tbody>{rows}</tbody></table>{matches === 0 && <p className="px-5 py-10 text-center text-sm text-[#718074]">{query ? <>No rows match &ldquo;{query}&rdquo;.</> : "Nothing here yet."}</p>}</div>
    {(matches > PAGE_SIZES[0] || size !== initialSize) && <nav aria-label="Table pages" className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[#5d685e]">
      <div className="flex items-center gap-3">
        <span>Showing <span className="font-semibold text-[#344e41]">{first}–{Math.min(page * size, matches)}</span> of <span className="font-semibold text-[#344e41]">{matches}</span>{query && ` (filtered from ${total})`}</span>
        <label className="flex items-center gap-2">Rows<select className="h-9 rounded-lg border border-[#cbd2c9] bg-white px-2 text-sm text-[#344e41]" onChange={(event) => go({ size: Number(event.target.value), page: 1 })} value={size}>{PAGE_SIZES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      </div>
      <div className="flex items-center gap-1">
        <PageButton disabled={page === 1 || pending} label="Previous page" onClick={() => go({ page: page - 1 })}><ChevronLeft size={16} aria-hidden="true" /></PageButton>
        {pageList(page, pages).map((item, index) => item === "…" ? <span className="px-1.5 text-[#9aa69c]" key={`gap-${index}`}>…</span> : <PageButton current={item === page} disabled={pending} key={item} label={`Page ${item}`} onClick={() => go({ page: item })}>{item}</PageButton>)}
        <PageButton disabled={page === pages || pending} label="Next page" onClick={() => go({ page: page + 1 })}><ChevronRight size={16} aria-hidden="true" /></PageButton>
      </div>
    </nav>}
  </div>;
}

function PageButton({ children, label, onClick, disabled, current }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; current?: boolean }) {
  return <button aria-current={current ? "page" : undefined} aria-label={label} className={cn("inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 font-semibold transition disabled:opacity-40", current ? "bg-[var(--kinja-green)] text-white disabled:opacity-100" : "text-[#344e41] hover:bg-[#eef1eb]")} disabled={disabled} onClick={onClick} type="button">{children}</button>;
}

// 1 … 4 5 6 … 23: the first and last pages, and one either side of the current one.
export function pageList(page: number, pages: number): Array<number | "…"> {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((item) => item >= 1 && item <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  return sorted.flatMap((item, index) => (index > 0 && item - sorted[index - 1] > 1 ? ["…" as const, item] : [item]));
}
